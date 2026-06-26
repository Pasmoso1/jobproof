import type { SupabaseClient } from "@supabase/supabase-js";
import { QUOTE_REQUEST_STORAGE_BUCKET } from "@/lib/quote-requests/constants";
import { getGenericFollowUpQuestions } from "@/lib/quote-requests/follow-up-generic";
import {
  type FollowUpQuestion,
  type FollowUpQuestionType,
  isFollowUpQuestionType,
} from "@/lib/quote-requests/follow-up-types";
import { getEffectiveQuoteTrade } from "@/lib/quote-requests/trade";
import { generateUUID } from "@/lib/utils/uuid";

const MAX_AI_PHOTOS = 4;
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 8;

type AiQuestionPayload = {
  question?: string;
  question_type?: string;
  options?: string[];
  display_order?: number;
};

type AiResponsePayload = {
  questions?: AiQuestionPayload[];
};

function buildSystemPrompt(): string {
  return `You generate optional follow-up questions for a home-services quote request.

Rules:
- Generate 3 to 6 useful questions (maximum 8).
- Do NOT ask about information already clearly stated in the customer description.
- Do NOT ask questions whose answers are already obvious from the photos.
- Use short, mobile-friendly wording.
- Prefer multiple_choice or yes_no when practical.
- Every question is optional for the customer.
- Question types allowed: multiple_choice, checkbox, short_text, number, date, yes_no.
- For multiple_choice and checkbox, include 2-6 concise options.
- Do not ask for duplicate contact info already collected on the form.

Photo analysis (internal only — never mention photo observations to the customer):
- Inspect uploaded photos to improve question selection only.
- If photos are unclear, blurry, irrelevant, or do not match the stated project type, include a clarification question instead of guessing.
- If project type is Deck but photo shows a kitchen, ask the customer to describe or upload the correct outdoor/deck area.
- If a photo is too blurry to interpret, ask for a clearer photo or a short description.
- If photos are not useful, fall back to trade and project-type questions.
- Never invent details from photos. Never state confident assumptions about what is in a photo.

Return JSON only:
{
  "questions": [
    {
      "question": "string",
      "question_type": "multiple_choice|checkbox|short_text|number|date|yes_no",
      "options": ["optional for choice types"],
      "display_order": 1
    }
  ]
}`;
}

function buildUserPrompt(input: {
  tradeLabel: string | null;
  primaryTrade: string | null;
  primaryTradeOther: string | null;
  projectType: string;
  description: string;
  photoCount: number;
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
    photoCountNote(input.photoCount),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function photoCountNote(photoCount: number): string {
  if (photoCount === 0) {
    return "No photos were uploaded. Use trade and project-type questions only.";
  }
  return "Photos are attached. Use them only to avoid redundant questions and to spot mismatches or unclear images.";
}

function normalizeAiQuestions(raw: AiQuestionPayload[]): FollowUpQuestion[] {
  const normalized: FollowUpQuestion[] = [];

  for (const item of raw) {
    const question = String(item.question ?? "").trim();
    const questionType = String(item.question_type ?? "").trim();
    if (!question || !isFollowUpQuestionType(questionType)) continue;

    const options =
      questionType === "multiple_choice" || questionType === "checkbox"
        ? (item.options ?? [])
            .map((o) => String(o).trim())
            .filter(Boolean)
            .slice(0, 6)
        : undefined;

    if (
      (questionType === "multiple_choice" || questionType === "checkbox") &&
      (!options || options.length < 2)
    ) {
      continue;
    }

    normalized.push({
      id: generateUUID(),
      question,
      question_type: questionType as FollowUpQuestionType,
      options,
      display_order: normalized.length + 1,
    });

    if (normalized.length >= MAX_QUESTIONS) break;
  }

  return normalized;
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

/**
 * Generate personalized follow-up questions via OpenAI vision. Falls back to generic questions on failure.
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

  const fallback = () => ({
    questions: getGenericFollowUpQuestions(input.projectType, tradeLabel),
    usedFallback: true,
  });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[follow-up-ai] OPENAI_API_KEY not configured");
    return fallback();
  }

  try {
    const imageUrls = await signAttachmentUrls(admin, input.attachmentPaths);
    const userText = buildUserPrompt({
      tradeLabel,
      primaryTrade: profile?.quote_primary_trade ? String(profile.quote_primary_trade) : null,
      primaryTradeOther: profile?.quote_primary_trade_other
        ? String(profile.quote_primary_trade_other)
        : null,
      projectType: input.projectType,
      description: input.description,
      photoCount: input.attachmentPaths.length,
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
        temperature: 0.4,
        max_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt() },
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

    const parsed = JSON.parse(content) as AiResponsePayload;
    const questions = normalizeAiQuestions(parsed.questions ?? []);

    if (questions.length < MIN_QUESTIONS) {
      console.warn("[follow-up-ai] too few questions, using fallback", {
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
