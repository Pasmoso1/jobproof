import type { SupabaseClient } from "@supabase/supabase-js";
import { QUOTE_REQUEST_STORAGE_BUCKET } from "@/lib/quote-requests/constants";
import type { FollowUpQuestion } from "@/lib/quote-requests/follow-up-types";
import {
  buildScopedFollowUpQuestions,
  normalizeCustomQuestionsFromAi,
  selectFallbackLibraryQuestionIds,
} from "@/lib/quote-requests/question-library/assemble";
import {
  getLibraryQuestionsForTrades,
  toCatalogEntry,
} from "@/lib/quote-requests/question-library/registry";
import { resolveLibraryTrades } from "@/lib/quote-requests/question-library/resolve-trade";
import type { AiQuestionSelectionResponse } from "@/lib/quote-requests/question-library/types";
import {
  normalizeScopeAssessment,
  saveQuoteRequestScopeAssessment,
  type ScopeAssessment,
} from "@/lib/quote-requests/scope-assessment";
import {
  customLimitForScope,
  getScopeFallbackCustomQuestions,
  inferHeuristicScopeAssessment,
} from "@/lib/quote-requests/scope-fallback";
import { getEffectiveQuoteTrade } from "@/lib/quote-requests/trade";

const MAX_AI_PHOTOS = 4;
const MIN_QUESTIONS = 3;

const DEFAULT_PHOTO_CLARIFICATION =
  "The uploaded photo doesn't appear to show the project area. Could you upload another photo or briefly describe that area?";

function buildSelectionSystemPrompt(): string {
  return `You are JobProof's quote follow-up decision engine.

STEP 1 — SCOPE ASSESSMENT (required before selecting questions):
Decide whether the customer request fits the contractor's listed trade.

Scope fit values (use exactly one):
- within_scope: Request clearly fits the contractor trade.
- mixed_scope: Request may include work the contractor could do AND work requiring another specialist.
- possibly_out_of_scope: Related but uncertain (e.g. handyman + electrical panel replacement).
- outside_scope: Request clearly does not fit the contractor trade (e.g. painter + pool installation).

Rules for scopeAssessment:
- reason: short and factual.
- contractorNote: for the contractor only — not shown to the customer. Do not say the contractor definitely cannot do the work unless clearly outside_scope. If uncertain, use mixed_scope or possibly_out_of_scope.
- customerClarificationNeeded: true when scope is mixed, possibly out of scope, or outside scope.

STEP 2 — QUESTION SELECTION:

You do NOT invent library question wording. Select question IDs from the JobProof Question Library catalog.

You MAY write custom_questions (2–5 max per rules below) with simple, mobile-friendly wording when needed.

Never ask budget or pricing-range questions. No legal advice. Do not claim the contractor offers a service.

Question selection by scope:

within_scope:
- Select 3–6 library question IDs (max 8 total).
- Skip questions for information already in the description or clearly visible in photos.
- If fewer than 3 strong library matches OR the project is a specialty task not well covered, add 2–5 custom_questions.

mixed_scope:
- Do NOT select generic trade-type library questions that miss the actual request (e.g. do NOT ask "what type of landscaping" when customer wants a pool).
- First custom_question MUST clarify what part of the work the customer needs.
- Example (landscaper + pool): "Are you looking for full pool installation, or work around the pool area?" with choices: Full pool installation | Patio, decking, or landscaping around a pool | Grading or drainage preparation | Landscaping around an existing pool | Not sure
- Then add useful custom follow-ups (pool type, access, surround work, timeline).
- Select library IDs only if directly relevant (max 4).

possibly_out_of_scope:
- First custom_question: clarify what part of the project they need help with.
- Then only broad clarifying custom questions (max 4). Library IDs max 2 if relevant.

outside_scope:
- Do NOT block the request. Select NO library IDs.
- Add 1–3 basic custom clarification questions only.
- Example: "This may be outside the contractor's listed trade. Could you briefly describe what part of the project you are hoping they can help with?"

Photo rules (internal only):
- Use photos to skip redundant library questions.
- If photos are blurry, irrelevant, wrong project area, or unclear: set photo_clarification_needed true with exactly ONE clarification question.
- Only one photo clarification. Never invent photo details.

Return JSON only:
{
  "scopeAssessment": {
    "fit": "within_scope|mixed_scope|possibly_out_of_scope|outside_scope",
    "reason": "string",
    "contractorNote": "string",
    "customerClarificationNeeded": true
  },
  "known_from_description": ["tag or phrase"],
  "known_from_photos": ["tag or phrase"],
  "selected_question_ids": ["library_question_id"],
  "custom_questions": [
    {
      "question": "string",
      "question_type": "multiple_choice|checkbox|short_text|number|date|yes_no",
      "options": ["optional"],
      "display_order": 1
    }
  ],
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
      ? "No photos uploaded — assess scope from description and trade only."
      : "Photos are attached — use them for scope assessment and to skip redundant questions.",
    "",
    "Question library catalog (select by id only; omit ids when out of scope or not relevant):",
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
  validIds: Set<string>,
  maxIds: number
): string[] {
  if (!raw?.selected_question_ids?.length) return [];

  const ids: string[] = [];
  for (const id of raw.selected_question_ids) {
    const normalized = String(id).trim();
    if (!validIds.has(normalized) || ids.includes(normalized)) continue;
    ids.push(normalized);
    if (ids.length >= maxIds) break;
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
  requestId: string;
  contractorId: string;
  projectType: string;
  description: string;
  attachmentPaths: string[];
};

export type GenerateFollowUpQuestionsOutput = {
  questions: FollowUpQuestion[];
  usedFallback: boolean;
  scopeAssessment: ScopeAssessment | null;
};

function buildFallbackOutput(input: {
  admin: SupabaseClient;
  requestId: string;
  libraryQuestions: ReturnType<typeof getLibraryQuestionsForTrades>;
  description: string;
  projectType: string;
  tradeLabel: string | null;
  primaryTrade: string | null;
}): GenerateFollowUpQuestionsOutput {
  const heuristicScope = inferHeuristicScopeAssessment({
    tradeLabel: input.tradeLabel,
    primaryTrade: input.primaryTrade,
    projectType: input.projectType,
    description: input.description,
  });

  void saveQuoteRequestScopeAssessment(input.admin, input.requestId, heuristicScope);

  const customQuestions =
    heuristicScope.fit === "within_scope"
      ? []
      : getScopeFallbackCustomQuestions(
          heuristicScope,
          input.projectType,
          input.description
        );

  const selectedIds =
    heuristicScope.fit === "within_scope"
      ? selectFallbackLibraryQuestionIds(input.libraryQuestions, input.description)
      : [];

  let questions = buildScopedFollowUpQuestions({
    scopeFit: heuristicScope.fit,
    libraryQuestions: input.libraryQuestions,
    selectedIds,
    customQuestions,
    description: input.description,
  });

  if (questions.length < MIN_QUESTIONS && heuristicScope.fit === "within_scope") {
    const backupIds = input.libraryQuestions
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 6)
      .map((q) => q.id);
    questions = buildScopedFollowUpQuestions({
      scopeFit: heuristicScope.fit,
      libraryQuestions: input.libraryQuestions,
      selectedIds: backupIds,
      customQuestions: [],
      description: input.description,
    });
  }

  return {
    questions,
    usedFallback: true,
    scopeAssessment: heuristicScope,
  };
}

/**
 * Assess scope and select follow-up questions from the JobProof library via OpenAI.
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

  const primaryTrade = profile?.quote_primary_trade ? String(profile.quote_primary_trade) : null;
  const primaryTradeOther = profile?.quote_primary_trade_other
    ? String(profile.quote_primary_trade_other)
    : null;

  const libraryTrades = resolveLibraryTrades({
    primaryTrade,
    primaryTradeOther,
    projectType: input.projectType,
  });

  const libraryQuestions = getLibraryQuestionsForTrades(libraryTrades);
  const validIds = new Set(libraryQuestions.map((q) => q.id));

  const heuristicDefault = inferHeuristicScopeAssessment({
    tradeLabel,
    primaryTrade,
    projectType: input.projectType,
    description: input.description,
  });

  const fallback = () =>
    buildFallbackOutput({
      admin,
      requestId: input.requestId,
      libraryQuestions,
      description: input.description,
      projectType: input.projectType,
      tradeLabel,
      primaryTrade,
    });

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
      primaryTrade,
      primaryTradeOther,
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
        max_tokens: 2000,
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
    const scopeAssessment = normalizeScopeAssessment(
      parsed?.scopeAssessment,
      heuristicDefault
    );

    await saveQuoteRequestScopeAssessment(admin, input.requestId, scopeAssessment);

    const knownTags = [
      ...(parsed?.known_from_description ?? []),
      ...(parsed?.known_from_photos ?? []),
    ]
      .map((t) => String(t).trim())
      .filter(Boolean);

    const clarification =
      parsed?.photo_clarification_needed === true
        ? String(parsed.photo_clarification_question ?? "").trim() ||
          DEFAULT_PHOTO_CLARIFICATION
        : null;

    const libraryIdLimit =
      scopeAssessment.fit === "outside_scope"
        ? 0
        : scopeAssessment.fit === "possibly_out_of_scope"
          ? 2
          : scopeAssessment.fit === "mixed_scope"
            ? 4
            : 8;

    const selectedIds = normalizeSelectedIds(parsed, validIds, libraryIdLimit);

    let customQuestions = normalizeCustomQuestionsFromAi(
      parsed?.custom_questions ?? [],
      customLimitForScope(scopeAssessment.fit)
    );

    if (
      customQuestions.length === 0 &&
      scopeAssessment.fit !== "within_scope"
    ) {
      customQuestions = getScopeFallbackCustomQuestions(
        scopeAssessment,
        input.projectType,
        input.description
      );
    }

    if (
      scopeAssessment.fit === "within_scope" &&
      selectedIds.length < MIN_QUESTIONS &&
      customQuestions.length === 0
    ) {
      customQuestions = normalizeCustomQuestionsFromAi(
        parsed?.custom_questions ?? [],
        5
      );
    }

    if (
      selectedIds.length === 0 &&
      customQuestions.length === 0 &&
      !clarification
    ) {
      console.warn("[follow-up-ai] no selections from AI, using fallback");
      return fallback();
    }

    const questions = buildScopedFollowUpQuestions({
      scopeFit: scopeAssessment.fit,
      libraryQuestions,
      selectedIds,
      customQuestions,
      description: input.description,
      knownTags,
      clarificationQuestion: clarification,
    });

    const minRequired = scopeAssessment.fit === "outside_scope" ? 1 : MIN_QUESTIONS;
    if (questions.length < minRequired) {
      console.warn("[follow-up-ai] too few assembled questions, using fallback", {
        count: questions.length,
        scope: scopeAssessment.fit,
      });
      return fallback();
    }

    return { questions, usedFallback: false, scopeAssessment };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[follow-up-ai] unexpected error", { message });
    return fallback();
  }
}
