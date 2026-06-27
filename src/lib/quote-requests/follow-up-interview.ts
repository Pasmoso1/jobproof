import type { SupabaseClient } from "@supabase/supabase-js";
import { QUOTE_REQUEST_STORAGE_BUCKET } from "@/lib/quote-requests/constants";
import {
  MAX_FOLLOW_UP_INTERVIEW_QUESTIONS,
  type FollowUpQuestion,
  type InterviewStepResult,
  type PreviousInterviewAnswer,
} from "@/lib/quote-requests/follow-up-types";
import { libraryQuestionToFollowUp } from "@/lib/quote-requests/question-library/assemble";
import {
  getLibraryQuestionById,
  getLibraryQuestionsForTrades,
  toCatalogEntry,
} from "@/lib/quote-requests/question-library/registry";
import { resolveLibraryTrades } from "@/lib/quote-requests/question-library/resolve-trade";
import { sortLibraryQuestions } from "@/lib/quote-requests/question-library/sort";
import type { LibraryQuestion } from "@/lib/quote-requests/question-library/types";
import {
  isScopeFit,
  normalizeScopeAssessment,
  saveQuoteRequestScopeAssessment,
  type ScopeAssessment,
  type ScopeFit,
} from "@/lib/quote-requests/scope-assessment";
import {
  getScopeFallbackCustomQuestions,
  inferHeuristicScopeAssessment,
} from "@/lib/quote-requests/scope-fallback";
import { detectSpecialty } from "@/lib/quote-requests/specialty/detection";
import {
  filterCatalogForSpecialty,
  getSpecialtyQuestionById,
  getSpecialtyQuestions,
  shouldBlockQuestionId,
} from "@/lib/quote-requests/specialty/registry";
import type { SpecialtyClassification } from "@/lib/quote-requests/specialty/types";
import type { AiInterviewStepResponse } from "@/lib/quote-requests/question-library/types";
import { getEffectiveQuoteTrade } from "@/lib/quote-requests/trade";
import { generateUUID } from "@/lib/utils/uuid";
import { isFollowUpQuestionType } from "@/lib/quote-requests/follow-up-types";

const MAX_AI_PHOTOS = 4;

const DEFAULT_PHOTO_CLARIFICATION =
  "The uploaded photo doesn't appear to show the project area. Could you upload another photo or briefly describe that area?";

function buildInterviewSystemPrompt(
  isFirstStep: boolean,
  specialty: SpecialtyClassification | null
): string {
  const specialtyRules = specialty
    ? `
SPECIALTY PROJECT DETECTED: ${specialty.label} (${specialty.key})
- Ask specialty catalog questions FIRST before generic trade questions.
- Do NOT ask generic landscaping yard condition, property size, or "what type of landscaping" questions.
- Do NOT ask "Will someone be on site/home?" — use project-specific access questions from the specialty catalog instead.
- Do NOT ask timeline or "how soon to move forward" as the first question${specialty.urgent ? " — this is urgent water intrusion; ask about active leaking and water source first" : ""}.
- After specialty questions are exhausted, select remaining relevant library IDs only.
- Branch based on answers: if customer confirms full pool installation, abandon generic landscaping questions (same pattern for foundation leaks vs yard questions).
`
    : "";

  return `You are an experienced contractor estimator conducting an adaptive quote interview for JobProof.
${specialtyRules}
Ask ONE question at a time. After each customer answer, decide the single most valuable next question.

Behave like a real estimator — not a long form. Questions should become more specific as the interview progresses. Natural finish is 3–5 questions. Maximum 6 total.

After each answer determine:
- What do I now know?
- What information is still missing?
- Is another question worthwhile?
- Have I learned enough?

If you have enough information for the contractor to understand the project, prepare for a site visit, and estimate complexity: set interview_complete to true. Do NOT ask questions just to fill a quota.

QUESTION SOURCES:
1. Prefer selected_library_question_id from the remaining catalog — use library wording EXACTLY (never paraphrase).
2. If no library question fits, provide ONE custom_question with simple mobile-friendly wording.
3. Never ask budget or pricing-range questions. No legal advice. Do not claim the contractor offers a service.

BRANCHING:
- Every answer must influence the next question.
- Remove questions already answered or no longer relevant.
- Example: if customer chose "Full pool installation", do NOT ask generic landscaping type questions — ask pool-specific follow-ups (inground/above-ground, pool selected, machine access, timeline).

${isFirstStep ? `FIRST STEP ONLY:
- Assess scope (scopeAssessment) if not already provided in context.
- Scope values: within_scope, mixed_scope, possibly_out_of_scope, outside_scope.
- contractorNote is for the contractor only — do not show to customer.
- Use photos to skip redundant questions. If photos are blurry/irrelevant/wrong area, you may ask ONE photo clarification as custom_question (only on first step).` : ""}

Return JSON only:
{
  "interview_complete": false,
  "complete_reason": null,
  "known_information": ["short phrase"],
  ${isFirstStep ? `"scopeAssessment": { "fit": "within_scope|mixed_scope|possibly_out_of_scope|outside_scope", "reason": "string", "contractorNote": "string", "customerClarificationNeeded": true },` : ""}
  "selected_library_question_id": "library_id_or_null",
  "custom_question": null,
  "photo_clarification_needed": false,
  "photo_clarification_question": null
}

When interview_complete is true, omit selected_library_question_id and custom_question.

For custom_question when needed:
{ "question": "string", "question_type": "multiple_choice|checkbox|short_text|number|date|yes_no", "options": ["optional"] }`;
}

function buildInterviewUserPrompt(input: {
  tradeLabel: string | null;
  primaryTrade: string | null;
  primaryTradeOther: string | null;
  projectType: string;
  description: string;
  photoCount: number;
  previousAnswers: PreviousInterviewAnswer[];
  specialtyCatalogJson: string | null;
  remainingCatalogJson: string;
  existingScopeFit: ScopeFit | null;
  questionNumber: number;
  specialty: SpecialtyClassification | null;
}): string {
  const tradeLine = input.tradeLabel
    ? `Contractor trade: ${input.tradeLabel}`
    : "Contractor trade: not specified";
  const otherTrade =
    input.primaryTrade === "Other" && input.primaryTradeOther?.trim()
      ? `Custom trade label: ${input.primaryTradeOther.trim()}`
      : null;

  const transcript =
    input.previousAnswers.length === 0
      ? "No interview answers yet — ask the first most valuable question."
      : input.previousAnswers
          .map(
            (a, i) =>
              `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer?.trim() || "(skipped)"}`
          )
          .join("\n\n");

  return [
    tradeLine,
    otherTrade,
    input.specialty
      ? `Detected job specialty: ${input.specialty.label} (${input.specialty.key}, urgent=${input.specialty.urgent})`
      : null,
    input.existingScopeFit ? `Current scope assessment: ${input.existingScopeFit}` : null,
    `Project type: ${input.projectType}`,
    `Customer description:\n${input.description}`,
    `Photos uploaded: ${input.photoCount}`,
    `Questions asked so far: ${input.previousAnswers.length} (maximum ${MAX_FOLLOW_UP_INTERVIEW_QUESTIONS})`,
    `Next question will be #${input.questionNumber}`,
    "",
    "Interview transcript:",
    transcript,
    input.specialtyCatalogJson
      ? `\nSpecialty question catalog (PREFER these ids first):\n${input.specialtyCatalogJson}`
      : null,
    "",
    "Remaining general question library catalog (select ONE id or use custom_question):",
    input.remainingCatalogJson,
  ]
    .filter(Boolean)
    .join("\n\n");
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

function askedLibraryIds(previousAnswers: PreviousInterviewAnswer[]): Set<string> {
  const ids = new Set<string>();
  for (const a of previousAnswers) {
    const id = a.library_question_id?.trim();
    if (id) ids.add(id);
  }
  return ids;
}

function buildCustomFollowUpQuestion(
  raw: NonNullable<AiInterviewStepResponse["custom_question"]>,
  displayOrder: number
): FollowUpQuestion | null {
  const question = String(raw.question ?? "").trim();
  const questionType = String(raw.question_type ?? "").trim();
  if (!question || !isFollowUpQuestionType(questionType)) return null;

  const options =
    questionType === "multiple_choice" || questionType === "checkbox"
      ? (raw.options ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 8)
      : undefined;

  if (
    (questionType === "multiple_choice" || questionType === "checkbox") &&
    (!options || options.length < 2)
  ) {
    return null;
  }

  return {
    id: generateUUID(),
    question,
    question_type: questionType,
    options,
    display_order: displayOrder,
    library_question_id: null,
    is_custom: true,
  };
}

function resolveQuestionById(id: string): LibraryQuestion | undefined {
  return getSpecialtyQuestionById(id) ?? getLibraryQuestionById(id);
}

function getFallbackNextQuestion(input: {
  specialty: SpecialtyClassification | null;
  scopeAssessment: ScopeAssessment;
  libraryQuestions: ReturnType<typeof getLibraryQuestionsForTrades>;
  previousAnswers: PreviousInterviewAnswer[];
  projectType: string;
  description: string;
  displayOrder: number;
  questionNumber: number;
}): FollowUpQuestion | null {
  const asked = askedLibraryIds(input.previousAnswers);

  if (input.specialty) {
    const specialtyQs = getSpecialtyQuestions(input.specialty);
    const nextSpecialty = specialtyQs.find((q) => !asked.has(q.id));
    if (nextSpecialty) {
      const followUp = libraryQuestionToFollowUp(nextSpecialty, input.displayOrder);
      return { ...followUp, library_question_id: nextSpecialty.id, is_custom: false };
    }
  }

  if (input.scopeAssessment.fit !== "within_scope" && !input.specialty) {
    const customs = getScopeFallbackCustomQuestions(
      input.scopeAssessment,
      input.projectType,
      input.description
    );
    const index = input.previousAnswers.length;
    const custom = customs[index];
    if (custom) {
      return { ...custom, display_order: input.displayOrder, is_custom: true };
    }
  }

  const remaining = sortLibraryQuestions(
    input.libraryQuestions.filter(
      (q) =>
        !asked.has(q.id) &&
        !shouldBlockQuestionId(q.id, input.specialty, input.questionNumber)
    )
  );

  const nextLibrary = remaining[0];
  if (nextLibrary) {
    const followUp = libraryQuestionToFollowUp(nextLibrary, input.displayOrder);
    return { ...followUp, library_question_id: nextLibrary.id, is_custom: false };
  }

  return null;
}

async function loadExistingScope(
  admin: SupabaseClient,
  requestId: string
): Promise<ScopeFit | null> {
  const { data } = await admin
    .from("quote_requests")
    .select("ai_scope_fit")
    .eq("id", requestId)
    .maybeSingle();

  const fit = String(data?.ai_scope_fit ?? "").trim();
  return isScopeFit(fit) ? fit : null;
}

export type GetNextInterviewStepInput = {
  requestId: string;
  contractorId: string;
  projectType: string;
  description: string;
  attachmentPaths: string[];
  previousAnswers: PreviousInterviewAnswer[];
};

export async function getNextInterviewStep(
  admin: SupabaseClient,
  input: GetNextInterviewStepInput
): Promise<InterviewStepResult> {
  const answeredCount = input.previousAnswers.length;

  if (answeredCount >= MAX_FOLLOW_UP_INTERVIEW_QUESTIONS) {
    return { status: "complete", usedFallback: false };
  }

  const questionNumber = answeredCount + 1;
  const displayOrder = questionNumber;

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

  const specialty = detectSpecialty(input.projectType, input.description);

  const libraryTrades = resolveLibraryTrades({
    primaryTrade,
    primaryTradeOther,
    projectType: input.projectType,
    description: input.description,
  });

  const libraryQuestions = getLibraryQuestionsForTrades(libraryTrades);
  const asked = askedLibraryIds(input.previousAnswers);
  const remainingCatalog = filterCatalogForSpecialty(
    libraryQuestions.filter((q) => !asked.has(q.id)),
    specialty,
    questionNumber
  ).map(toCatalogEntry);

  const specialtyCatalogJson = specialty
    ? JSON.stringify(
        getSpecialtyQuestions(specialty)
          .filter((q) => !asked.has(q.id))
          .map(toCatalogEntry)
      )
    : null;

  const existingScopeFit = await loadExistingScope(admin, input.requestId);
  const isFirstStep = answeredCount === 0;

  const heuristicScope = inferHeuristicScopeAssessment({
    tradeLabel,
    primaryTrade,
    projectType: input.projectType,
    description: input.description,
  });

  const fallbackNext = (scope: ScopeAssessment): InterviewStepResult => {
    const question = getFallbackNextQuestion({
      specialty,
      scopeAssessment: scope,
      libraryQuestions,
      previousAnswers: input.previousAnswers,
      projectType: input.projectType,
      description: input.description,
      displayOrder,
      questionNumber,
    });

    if (!question) {
      return { status: "complete", usedFallback: true };
    }

    return {
      status: "question",
      question,
      questionNumber,
      maxQuestions: MAX_FOLLOW_UP_INTERVIEW_QUESTIONS,
      usedFallback: true,
    };
  };

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[follow-up-interview] OPENAI_API_KEY not configured");
    if (isFirstStep && !existingScopeFit) {
      await saveQuoteRequestScopeAssessment(admin, input.requestId, heuristicScope);
    }
    return fallbackNext(heuristicScope);
  }

  try {
    const userText = buildInterviewUserPrompt({
      tradeLabel,
      primaryTrade,
      primaryTradeOther,
      projectType: input.projectType,
      description: input.description,
      photoCount: input.attachmentPaths.length,
      previousAnswers: input.previousAnswers,
      specialtyCatalogJson,
      remainingCatalogJson: JSON.stringify(remainingCatalog),
      existingScopeFit,
      questionNumber,
      specialty,
    });

    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "low" } }
    > = [{ type: "text", text: userText }];

    if (isFirstStep && input.attachmentPaths.length > 0) {
      const imageUrls = await signAttachmentUrls(admin, input.attachmentPaths);
      for (const url of imageUrls) {
        userContent.push({ type: "image_url", image_url: { url, detail: "low" } });
      }
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
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildInterviewSystemPrompt(isFirstStep, specialty) },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[follow-up-interview] OpenAI error", {
        status: response.status,
        message: (await response.text()).slice(0, 500),
      });
      if (isFirstStep && !existingScopeFit) {
        await saveQuoteRequestScopeAssessment(admin, input.requestId, heuristicScope);
      }
      return fallbackNext(heuristicScope);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      if (isFirstStep && !existingScopeFit) {
        await saveQuoteRequestScopeAssessment(admin, input.requestId, heuristicScope);
      }
      return fallbackNext(heuristicScope);
    }

    let parsed: AiInterviewStepResponse;
    try {
      parsed = JSON.parse(content) as AiInterviewStepResponse;
    } catch {
      if (isFirstStep && !existingScopeFit) {
        await saveQuoteRequestScopeAssessment(admin, input.requestId, heuristicScope);
      }
      return fallbackNext(heuristicScope);
    }

    if (isFirstStep && parsed.scopeAssessment && !existingScopeFit) {
      const scopeAssessment = normalizeScopeAssessment(
        parsed.scopeAssessment,
        heuristicScope
      );
      await saveQuoteRequestScopeAssessment(admin, input.requestId, scopeAssessment);
    }

    if (parsed.interview_complete === true) {
      return { status: "complete", usedFallback: false };
    }

    const scopeForFallback = normalizeScopeAssessment(
      parsed.scopeAssessment,
      heuristicScope
    );

    if (
      isFirstStep &&
      parsed.photo_clarification_needed === true &&
      !asked.has("__photo_clarification__")
    ) {
      const clarificationText =
        String(parsed.photo_clarification_question ?? "").trim() ||
        DEFAULT_PHOTO_CLARIFICATION;
      return {
        status: "question",
        question: {
          id: generateUUID(),
          question: clarificationText,
          question_type: "short_text",
          display_order: displayOrder,
          library_question_id: "__photo_clarification__",
          is_custom: true,
        },
        questionNumber,
        maxQuestions: MAX_FOLLOW_UP_INTERVIEW_QUESTIONS,
        usedFallback: false,
      };
    }

    const libraryId = String(parsed.selected_library_question_id ?? "").trim();
    if (
      libraryId &&
      !asked.has(libraryId) &&
      !shouldBlockQuestionId(libraryId, specialty, questionNumber)
    ) {
      const libraryQuestion = resolveQuestionById(libraryId);
      if (libraryQuestion) {
        const followUp = libraryQuestionToFollowUp(libraryQuestion, displayOrder);
        return {
          status: "question",
          question: {
            ...followUp,
            library_question_id: libraryQuestion.id,
            is_custom: false,
          },
          questionNumber,
          maxQuestions: MAX_FOLLOW_UP_INTERVIEW_QUESTIONS,
          usedFallback: false,
        };
      }
    }

    if (parsed.custom_question) {
      const custom = buildCustomFollowUpQuestion(parsed.custom_question, displayOrder);
      if (custom) {
        return {
          status: "question",
          question: custom,
          questionNumber,
          maxQuestions: MAX_FOLLOW_UP_INTERVIEW_QUESTIONS,
          usedFallback: false,
        };
      }
    }

    return fallbackNext(scopeForFallback);
  } catch (err) {
    console.error("[follow-up-interview] unexpected error", err);
    if (isFirstStep && !existingScopeFit) {
      await saveQuoteRequestScopeAssessment(admin, input.requestId, heuristicScope);
    }
    return fallbackNext(heuristicScope);
  }
}
