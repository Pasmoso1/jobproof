import type { SupabaseClient } from "@supabase/supabase-js";
import { QUOTE_REQUEST_STORAGE_BUCKET } from "@/lib/quote-requests/constants";
import type { FollowUpQuestion } from "@/lib/quote-requests/follow-up-types";
import {
  assembleFollowUpQuestions,
  selectFallbackLibraryQuestionIds,
} from "@/lib/quote-requests/question-library/assemble";
import {
  getLibraryQuestionsForTrades,
  toCatalogEntry,
} from "@/lib/quote-requests/question-library/registry";
import { resolveLibraryTrades } from "@/lib/quote-requests/question-library/resolve-trade";
import type { AiQuestionSelectionResponse } from "@/lib/quote-requests/question-library/types";
import { getEffectiveQuoteTrade } from "@/lib/quote-requests/trade";

const MAX_AI_PHOTOS = 4;
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 8;

const DEFAULT_PHOTO_CLARIFICATION =
  "The uploaded photo doesn't appear to show the project area. Could you upload another photo or briefly describe that area?";

function buildSelectionSystemPrompt(): string {
  return `You are JobProof's quote follow-up decision engine.

You do NOT write new question wording except for ONE optional photo clarification when required.

Your job:
1. Read the contractor trade, project type, customer description, and uploaded photos.
2. Determine what information is already known from the description and photos.
3. Select the best 3–6 question IDs from the provided JobProof Question Library (maximum 8).
4. Prefer very_high and high priority questions that improve quote accuracy and site visit preparation.
5. Do NOT select questions for information already stated in the description or clearly visible in photos.
6. Do NOT invent question IDs — only use IDs from the catalog.
7. Do NOT select budget or pricing-range questions (none exist in the library).

Photo rules (internal analysis only — never describe photo observations to the customer):
- Use photos to eliminate redundant library questions.
- Example: if photos clearly show stairs, railings, and pressure-treated decking, do NOT select questions about those features.
- If photos are blurry, irrelevant, wrong project area, or unclear, set photo_clarification_needed to true and provide exactly ONE short clarification question.
- Only one photo clarification question. Do not ask repeatedly for more photos.
- Never invent details from photos. Never make confident assumptions.

Question priority order when selecting:
1. Project size
2. Existing conditions
3. Materials
4. Special features
5. Access / removal
6. Desired completion timeframe
7. Customer preferences

Return JSON only:
{
  "known_from_description": ["tag or short phrase"],
  "known_from_photos": ["tag or short phrase"],
  "selected_question_ids": ["library_question_id"],
  "photo_clarification_needed": false,
  "photo_clarification_question": null
}`;
}

function buildSelectionUserPrompt(input: {
  tradeLabel: string | null;
  primaryTrade: string | null;
  primaryTradeOther: string | null;
  projectType: string;
  description: string;
  photoCount: number;
  catalogJson: string;
}): string {
  const tradeLine = input.tradeLabel
    ? `Contractor trade: ${input.tradeLabel}`
    : "Contractor trade: not specified";
  const otherTrade =
    input.primaryTrade === "Other" && input.primaryTradeOther?.trim()
      ? `Custom trade label: ${input.primaryTradeOther.trim()}`
      : null;

  return [
    tradeLine,
    otherTrade,
    `Project type: ${input.projectType}`,
    `Customer description:\n${input.description}`,
    `Number of photos uploaded: ${input.photoCount}`,
    input.photoCount === 0
      ? "No photos uploaded — select from library based on description and trade only."
      : "Photos are attached — use them to skip redundant library questions or request one clarification if needed.",
    "",
    "Question library catalog (select by id only):",
    input.catalogJson,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function parseSelectionResponse(content: string): AiQuestionSelectionResponse | null {
  try {
    return JSON.parse(content) as AiQuestionSelectionResponse;
  } catch {
    return null;
  }
}

function normalizeSelectedIds(
  raw: AiQuestionSelectionResponse | null,
  validIds: Set<string>
): string[] {
  if (!raw?.selected_question_ids?.length) return [];

  const ids: string[] = [];
  for (const id of raw.selected_question_ids) {
    const normalized = String(id).trim();
    if (!validIds.has(normalized) || ids.includes(normalized)) continue;
    ids.push(normalized);
    if (ids.length >= MAX_QUESTIONS) break;
  }
  return ids;
}

async function signAttachmentUrls(
  admin: SupabaseClient,
  attachmentPaths: string[]
): Promise<string[]> {
  const urls: string[] = [];
  for (const filePath of attachmentPaths.slice(0, MAX_AI_PHOTOS)) {
    const { data } = await admin.storage
      .from(QUOTE_REQUEST_STORAGE_BUCKET)
      .createSignedUrl(filePath, 3600);
    if (data?.signedUrl) {
      urls.push(data.signedUrl);
    }
  }
  return urls;
}

export type GenerateFollowUpQuestionsInput = {
  contractorId: string;
  projectType: string;
  description: string;
  attachmentPaths: string[];
};

export type GenerateFollowUpQuestionsOutput = {
  questions: FollowUpQuestion[];
  usedFallback: boolean;
};

function buildFallbackOutput(
  libraryQuestions: ReturnType<typeof getLibraryQuestionsForTrades>,
  description: string
): GenerateFollowUpQuestionsOutput {
  const selectedIds = selectFallbackLibraryQuestionIds(libraryQuestions, description);
  let questions = assembleFollowUpQuestions({
    libraryQuestions,
    selectedIds,
    description,
  });

  if (questions.length < MIN_QUESTIONS) {
    const backupIds = libraryQuestions
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 6)
      .map((q) => q.id);
    questions = assembleFollowUpQuestions({
      libraryQuestions,
      selectedIds: backupIds,
      description,
    });
  }

  return {
    questions,
    usedFallback: true,
  };
}

/**
 * Select personalized follow-up questions from the JobProof library via OpenAI. Falls back to priority-based library selection on failure.
 */
export async function generateFollowUpQuestions(
  admin: SupabaseClient,
  input: GenerateFollowUpQuestionsInput
): Promise<GenerateFollowUpQuestionsOutput> {
  const { data: profile } = await admin
    .from("profiles")
    .select("quote_primary_trade, quote_primary_trade_other")
    .eq("id", input.contractorId)
    .maybeSingle();

  const tradeLabel = getEffectiveQuoteTrade({
    quote_primary_trade: profile?.quote_primary_trade,
    quote_primary_trade_other: profile?.quote_primary_trade_other,
  });

  const libraryTrades = resolveLibraryTrades({
    primaryTrade: profile?.quote_primary_trade ? String(profile.quote_primary_trade) : null,
    primaryTradeOther: profile?.quote_primary_trade_other
      ? String(profile.quote_primary_trade_other)
      : null,
    projectType: input.projectType,
  });

  const libraryQuestions = getLibraryQuestionsForTrades(libraryTrades);
  const validIds = new Set(libraryQuestions.map((q) => q.id));

  const fallback = () => buildFallbackOutput(libraryQuestions, input.description);

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[follow-up-ai] OPENAI_API_KEY not configured");
    return fallback();
  }

  try {
    const catalog = libraryQuestions.map(toCatalogEntry);
    const catalogJson = JSON.stringify(catalog);

    const imageUrls = await signAttachmentUrls(admin, input.attachmentPaths);
    const userText = buildSelectionUserPrompt({
      tradeLabel,
      primaryTrade: profile?.quote_primary_trade ? String(profile.quote_primary_trade) : null,
      primaryTradeOther: profile?.quote_primary_trade_other
        ? String(profile.quote_primary_trade_other)
        : null,
      projectType: input.projectType,
      description: input.description,
      photoCount: input.attachmentPaths.length,
      catalogJson,
    });

    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "low" } }
    > = [{ type: "text", text: userText }];

    for (const url of imageUrls) {
      userContent.push({ type: "image_url", image_url: { url, detail: "low" } });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSelectionSystemPrompt() },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[follow-up-ai] OpenAI error", {
        status: response.status,
        message: errText.slice(0, 500),
      });
      return fallback();
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error("[follow-up-ai] empty OpenAI response");
      return fallback();
    }

    const parsed = parseSelectionResponse(content);
    const selectedIds = normalizeSelectedIds(parsed, validIds);

    const knownTags = [
      ...(parsed?.known_from_description ?? []),
      ...(parsed?.known_from_photos ?? []),
    ].map((t) => String(t).trim()).filter(Boolean);

    const clarification =
      parsed?.photo_clarification_needed === true
        ? String(parsed.photo_clarification_question ?? "").trim() ||
          DEFAULT_PHOTO_CLARIFICATION
        : null;

    if (selectedIds.length === 0 && !clarification) {
      console.warn("[follow-up-ai] no selections from AI, using fallback");
      return fallback();
    }

    const questions = assembleFollowUpQuestions({
      libraryQuestions,
      selectedIds,
      description: input.description,
      knownTags,
      clarificationQuestion: clarification,
    });

    if (questions.length < MIN_QUESTIONS) {
      console.warn("[follow-up-ai] too few assembled questions, using fallback", {
        count: questions.length,
      });
      return fallback();
    }

    return { questions, usedFallback: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[follow-up-ai] unexpected error", { message });
    return fallback();
  }
}
