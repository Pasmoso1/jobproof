import type { SupabaseClient } from "@supabase/supabase-js";
import { QUOTE_REQUEST_STORAGE_BUCKET } from "@/lib/quote-requests/constants";
import {
  MAX_FOLLOW_UP_INTERVIEW_QUESTIONS,
  type FollowUpQuestion,
  type InterviewStepResult,
  type PreviousInterviewAnswer,
  isFollowUpQuestionType,
} from "@/lib/quote-requests/follow-up-types";
import {
  allowProblemLibrary,
  filterProblemRelevantCatalog,
  getInterviewQuestionLimit,
  isBlockedCustomQuestionText,
  isLikelyOutOfScope,
  shouldBlockInterviewQuestion,
  shouldStopInterview,
} from "@/lib/quote-requests/interview-policy";
import { libraryQuestionToFollowUp } from "@/lib/quote-requests/question-library/assemble";
import {
  getLibraryQuestionById,
  getLibraryQuestionsForTrades,
  toCatalogEntry,
} from "@/lib/quote-requests/question-library/registry";
import { resolveProblemLibraryTrades } from "@/lib/quote-requests/question-library/resolve-trade";
import { sortLibraryQuestions } from "@/lib/quote-requests/question-library/sort";
import type {
  AiInterviewStepResponse,
  LibraryQuestion,
} from "@/lib/quote-requests/question-library/types";
import {
  classifyCustomerProblem,
  type CustomerProblem,
} from "@/lib/quote-requests/problem-classification";
import { assessScopeFromWork, workScopeToScopeAssessment } from "@/lib/quote-requests/work-components/scope-engine";
import {
  getNextScopeFallbackQuestion,
} from "@/lib/quote-requests/scope-fallback";
import {
  isScopeFit,
  normalizeScopeAssessment,
  saveQuoteRequestScopeAssessment,
  type ScopeAssessment,
  type ScopeFit,
} from "@/lib/quote-requests/scope-assessment";
import { detectSpecialty } from "@/lib/quote-requests/specialty/detection";
import {
  getSpecialtyQuestionById,
  getSpecialtyQuestions,
} from "@/lib/quote-requests/specialty/registry";
import type { SpecialtyClassification } from "@/lib/quote-requests/specialty/types";
import { buildUnifiedUnderstandingBlock } from "@/lib/quote-requests/interview-context";
import { getEffectiveQuoteTrade, normalizeAdditionalTrades } from "@/lib/quote-requests/trade";
import { generateUUID } from "@/lib/utils/uuid";

const MAX_AI_PHOTOS = 4;

const DEFAULT_PHOTO_CLARIFICATION =
  "The uploaded photo doesn't appear to show the project area. Could you upload another photo or briefly describe that area?";

function buildInterviewSystemPrompt(input: {
  isFirstStep: boolean;
  customerProblem: CustomerProblem;
  scopeFit: ScopeFit;
  isUrgent: boolean;
  allowTradeLibrary: boolean;
}): string {
  const scopeRules =
    input.scopeFit === "outside_scope" || input.scopeFit === "possibly_out_of_scope"
      ? `
OUT OF SCOPE (${input.scopeFit}):
- Ask at most 2 broad clarification questions only.
- Do NOT use contractor trade library questions.
- Do NOT ask landscaping/roofing/painting questions based on contractor trade.
- Set interview_complete true after enough clarification.
`
      : input.scopeFit === "mixed_scope"
        ? `
MIXED SCOPE:
- Ask ONE clarifying question first to learn which part of the work the customer needs from THIS contractor.
- Do NOT use contractor trade library unless the customer's answer confirms matching work.
- If customer confirms specialist-only work (e.g. full pool install for a landscaper), set interview_complete true.
`
        : `
WITHIN SCOPE:
- Use problem-specific specialty catalog questions FIRST when available.
- Use question library only for the customer's actual problem — NOT the contractor's unrelated trade.
- Do not ask low-value generic questions (yard condition, property size, someone home, timeline/readiness).
`;

  const urgentRules = input.isUrgent
    ? `
URGENT REQUEST (customer checked urgent):
- Do NOT ask timing, readiness, start date, or "how soon to move forward" questions — urgent already answers that.
- Ask about severity, safety, active damage, access for immediate assessment, or preparation instead.
`
    : "";

  return `You are an experienced contractor estimator conducting an adaptive quote interview for JobProof.

INTERVIEW LOGIC ORDER (mandatory):
1. Understand the customer's actual request — synthesize description, photos, prior answers (NOT project type alone).
2. Decompose required WORK COMPONENTS (demolition, plumbing, waterproofing, landscaping, etc.) — what work is needed to complete this project?
3. Compare each work component against contractor capabilities — clearly performs / may perform / unlikely.
4. Assign scopeAssessment based on the COMBINATION of work components, not a single trade label.
5. Only then choose the next follow-up question.

SCOPE ASSESSMENT (first step):
Think like an experienced estimator: "What work is required?" not "Does this match the contractor trade?"
- Decompose work from description (primary), photos, interview answers, then project type (hint only).
- Default to mixed_scope when some components match and others need specialists.
- Reserve within_scope for high confidence when ALL required work clearly aligns.
- Lower confidence when: multiple trades, description vs project type conflict, ambiguity, specialist work.
- contractorNote format (contractor-facing only):
  Detected project: [label]
  Work likely involved: [components]
  Why this may or may not match: [summary]
  Confidence: [high/medium/low]

Detected customer problem: ${input.customerProblem.label} (confidence: ${input.customerProblem.confidence})
Scope fit: ${input.scopeFit}
${scopeRules}
${urgentRules}

QUESTION VALUE RULE:
Only ask a question if the answer helps the contractor: decide if they can take the job, understand severity/urgency, prepare tools/materials/crew, plan access, understand size/complexity, identify safety issues, or prepare for a first call.

INFORMATION SYNTHESIS (every step):
Before selecting ANY question, synthesize ALL inputs in this priority order:
1. Customer description (highest — overrides Project Type when they conflict)
2. Uploaded photos
3. Previous interview answers
4. Project Type (lowest text priority)
5. Urgent flag (timing only — not project details)

Ask yourself: "Do I already know this with reasonable confidence?"
- If YES → do not ask; move to the next unknown or set interview_complete.
- If inputs conflict → resolve in known_information / resolved_conflicts before asking.
- If uncertainty remains → ask ONE targeted clarification only.

Populate known_information with everything already established from description, photos, and prior answers. Carry photo observations forward on every step.

Ask ONE question at a time. Natural finish is 3–5 questions. Maximum ${getInterviewQuestionLimit(input.scopeFit)} for this scope fit (${MAX_FOLLOW_UP_INTERVIEW_QUESTIONS} absolute max).

QUESTION SOURCES:
1. Prefer selected_library_question_id from the provided catalog — use library wording EXACTLY.
2. If no library question fits, provide ONE custom_question with simple mobile-friendly wording.
3. Never ask budget or pricing-range questions.

${input.isFirstStep ? `FIRST STEP ONLY:
- Confirm or refine customerProblem and scopeAssessment in your JSON response.
- contractorNote is for the contractor only — never show to customer.
- Use photos to skip redundant questions.` : ""}

Return JSON only:
{
  "interview_complete": false,
  "complete_reason": null,
  "known_information": ["short phrase"],
  "resolved_conflicts": ["optional — how you reconciled conflicting inputs"],
  ${input.isFirstStep ? `"customerProblem": { "label": "string", "confidence": "high|medium|low", "reasoning": "string" },
  "scopeAssessment": {
    "fit": "within_scope|mixed_scope|possibly_out_of_scope|outside_scope",
    "reason": "string",
    "contractorNote": "string (use Detected project / Work likely involved / Why / Confidence format)",
    "customerClarificationNeeded": true,
    "confidence": "high|medium|low",
    "workComponents": [{ "key": "string", "label": "string", "capability": "clearly_performs|may_perform|unlikely_to_perform", "typicalSpecialist": "optional" }],
    "specialistTrades": ["string"]
  },` : ""}
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
  additionalTrades: string[];
  customerProblem: CustomerProblem;
  scopeAssessment: ScopeAssessment;
  projectType: string;
  description: string;
  isUrgent: boolean;
  photoCount: number;
  previousAnswers: PreviousInterviewAnswer[];
  specialtyCatalogJson: string | null;
  remainingCatalogJson: string | null;
  allowTradeLibrary: boolean;
  questionNumber: number;
  maxQuestions: number;
  specialty: SpecialtyClassification | null;
}): string {
  const tradeLine = input.tradeLabel
    ? `Contractor primary trade: ${input.tradeLabel}`
    : "Contractor primary trade: not specified";
  const additionalTradesLine =
    input.additionalTrades.length > 0
      ? `Additional trades: ${input.additionalTrades.join(", ")}`
      : null;
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

  const unifiedUnderstanding = buildUnifiedUnderstandingBlock({
    description: input.description,
    projectType: input.projectType,
    isUrgent: input.isUrgent,
    photoCount: input.photoCount,
    previousAnswers: input.previousAnswers,
    customerProblem: input.customerProblem,
  });

  return [
    unifiedUnderstanding,
    "",
    tradeLine,
    additionalTradesLine,
    otherTrade,
    `Customer problem (detected): ${input.customerProblem.label}`,
    `Problem confidence: ${input.customerProblem.confidence}`,
    `Problem reasoning: ${input.customerProblem.reasoning}`,
    `Scope assessment: ${input.scopeAssessment.fit} — ${input.scopeAssessment.reason}`,
    input.isUrgent
      ? "URGENT: Customer marked this request as urgent. Do not ask timing/readiness questions."
      : "Urgent flag: not set",
    `Photos uploaded: ${input.photoCount}${input.photoCount > 0 ? " (attached for your review)" : ""}`,
    `Questions asked so far: ${input.previousAnswers.length} (maximum ${input.maxQuestions} for this scope)`,
    `Next question will be #${input.questionNumber}`,
    input.allowTradeLibrary
      ? "Trade library: allowed for problem-relevant questions only."
      : "Trade library: NOT allowed — use scope clarification or specialty questions only.",
    "",
    "Interview transcript:",
    transcript,
    input.specialtyCatalogJson
      ? `\nProblem-specific specialty catalog (PREFER these when in scope):\n${input.specialtyCatalogJson}`
      : null,
    input.remainingCatalogJson
      ? `\nRemaining problem-relevant library catalog:\n${input.remainingCatalogJson}`
      : "\nNo trade library catalog available for this scope.",
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
  displayOrder: number,
  isUrgent: boolean
): FollowUpQuestion | null {
  const question = String(raw.question ?? "").trim();
  const questionType = String(raw.question_type ?? "").trim();
  if (!question || !isFollowUpQuestionType(questionType)) return null;
  if (isBlockedCustomQuestionText(question, isUrgent)) return null;

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

function normalizeCustomerProblem(
  raw: AiInterviewStepResponse["customerProblem"] | null | undefined,
  fallback: CustomerProblem
): CustomerProblem {
  const label = String(raw?.label ?? "").trim();
  const confidenceRaw = String(raw?.confidence ?? "").trim();
  const confidence =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
      ? confidenceRaw
      : fallback.confidence;
  const reasoning = String(raw?.reasoning ?? "").trim();

  if (!label) return fallback;

  return {
    key: fallback.key,
    label,
    confidence,
    reasoning: reasoning || fallback.reasoning,
  };
}

function getFallbackNextQuestion(input: {
  customerProblem: CustomerProblem;
  specialty: SpecialtyClassification | null;
  scopeAssessment: ScopeAssessment;
  allowTradeLibrary: boolean;
  libraryQuestions: LibraryQuestion[];
  previousAnswers: PreviousInterviewAnswer[];
  projectType: string;
  description: string;
  isUrgent: boolean;
  displayOrder: number;
  questionNumber: number;
}): FollowUpQuestion | null {
  if (
    shouldStopInterview({
      answeredCount: input.previousAnswers.length,
      scopeFit: input.scopeAssessment.fit,
      isUrgent: input.isUrgent,
      previousAnswers: input.previousAnswers,
      customerProblem: input.customerProblem,
      specialty: input.specialty,
    })
  ) {
    return null;
  }

  const asked = askedLibraryIds(input.previousAnswers);

  if (
    input.specialty &&
    !isLikelyOutOfScope(input.scopeAssessment.fit) &&
    (input.scopeAssessment.fit === "within_scope" ||
      (input.scopeAssessment.fit === "mixed_scope" && input.allowTradeLibrary))
  ) {
    const specialtyQs = getSpecialtyQuestions(input.specialty);
    const nextSpecialty = specialtyQs.find((q) => !asked.has(q.id));
    if (nextSpecialty) {
      const followUp = libraryQuestionToFollowUp(nextSpecialty, input.displayOrder);
      return { ...followUp, library_question_id: nextSpecialty.id, is_custom: false };
    }
  }

  if (
    input.scopeAssessment.fit !== "within_scope" ||
    !input.allowTradeLibrary
  ) {
    const scopeQuestion = getNextScopeFallbackQuestion({
      scope: input.scopeAssessment,
      customerProblem: input.customerProblem,
      projectType: input.projectType,
      description: input.description,
      isUrgent: input.isUrgent,
      previousAnswers: input.previousAnswers,
      displayOrder: input.displayOrder,
    });
    if (scopeQuestion) {
      return scopeQuestion;
    }
    if (!input.allowTradeLibrary || isLikelyOutOfScope(input.scopeAssessment.fit)) {
      return null;
    }
  }

  const remaining = sortLibraryQuestions(
    input.libraryQuestions.filter(
      (q) =>
        !asked.has(q.id) &&
        !shouldBlockInterviewQuestion({
          questionId: q.id,
          scopeFit: input.scopeAssessment.fit,
          isUrgent: input.isUrgent,
          allowTradeLibrary: input.allowTradeLibrary,
          specialty: input.specialty,
          questionNumber: input.questionNumber,
        })
    )
  );

  const nextLibrary = remaining[0];
  if (nextLibrary) {
    const followUp = libraryQuestionToFollowUp(nextLibrary, input.displayOrder);
    return { ...followUp, library_question_id: nextLibrary.id, is_custom: false };
  }

  return null;
}

async function loadRequestInterviewState(
  admin: SupabaseClient,
  requestId: string
): Promise<{ scopeFit: ScopeFit | null; isUrgent: boolean }> {
  const { data } = await admin
    .from("quote_requests")
    .select("ai_scope_fit, is_urgent")
    .eq("id", requestId)
    .maybeSingle();

  const fit = String(data?.ai_scope_fit ?? "").trim();
  return {
    scopeFit: isScopeFit(fit) ? fit : null,
    isUrgent: Boolean(data?.is_urgent),
  };
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

  const { data: profile } = await admin
    .from("profiles")
    .select("quote_primary_trade, quote_primary_trade_other, quote_additional_trades, contractor_extra_capabilities")
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
  const additionalTrades = normalizeAdditionalTrades(profile?.quote_additional_trades);
  const extraCapabilities = profile?.contractor_extra_capabilities
    ? String(profile.contractor_extra_capabilities)
    : null;

  const customerProblem = classifyCustomerProblem(input.projectType, input.description);
  const specialty = detectSpecialty(input.projectType, input.description);
  const heuristicScope = workScopeToScopeAssessment(
    assessScopeFromWork({
      customerProblem,
      tradeLabel,
      primaryTrade,
      primaryTradeOther,
      additionalTrades,
      extraCapabilities,
      projectType: input.projectType,
      description: input.description,
      previousAnswers: input.previousAnswers,
    })
  );

  const { scopeFit: existingScopeFit, isUrgent } = await loadRequestInterviewState(
    admin,
    input.requestId
  );
  const scopeAssessment = existingScopeFit
    ? { ...heuristicScope, fit: existingScopeFit }
    : heuristicScope;

  const maxQuestions = getInterviewQuestionLimit(scopeAssessment.fit);
  if (answeredCount >= maxQuestions || answeredCount >= MAX_FOLLOW_UP_INTERVIEW_QUESTIONS) {
    return { status: "complete", usedFallback: false };
  }

  if (
    shouldStopInterview({
      answeredCount,
      scopeFit: scopeAssessment.fit,
      isUrgent,
      previousAnswers: input.previousAnswers,
      customerProblem,
      specialty,
    })
  ) {
    return { status: "complete", usedFallback: false };
  }

  const questionNumber = answeredCount + 1;
  const displayOrder = questionNumber;
  const isFirstStep = answeredCount === 0;

  const allowTradeLibrary = allowProblemLibrary(
    scopeAssessment.fit,
    input.previousAnswers,
    customerProblem
  );

  const problemTrades = resolveProblemLibraryTrades(input.projectType, input.description);
  const libraryQuestions = allowTradeLibrary
    ? getLibraryQuestionsForTrades(problemTrades)
    : [];

  const asked = askedLibraryIds(input.previousAnswers);

  const remainingCatalog = allowTradeLibrary
    ? filterProblemRelevantCatalog(
        libraryQuestions.filter((q) => !asked.has(q.id)).map(toCatalogEntry),
        {
          scopeFit: scopeAssessment.fit,
          isUrgent,
          allowTradeLibrary,
          specialty,
          questionNumber,
        }
      )
    : [];

  const specialtyCatalogJson =
    specialty &&
    !isLikelyOutOfScope(scopeAssessment.fit) &&
    (scopeAssessment.fit === "within_scope" ||
      (scopeAssessment.fit === "mixed_scope" && allowTradeLibrary))
      ? JSON.stringify(
          getSpecialtyQuestions(specialty)
            .filter((q) => !asked.has(q.id))
            .map(toCatalogEntry)
        )
      : null;

  const fallbackNext = (scope: ScopeAssessment): InterviewStepResult => {
    const question = getFallbackNextQuestion({
      customerProblem,
      specialty,
      scopeAssessment: scope,
      allowTradeLibrary,
      libraryQuestions,
      previousAnswers: input.previousAnswers,
      projectType: input.projectType,
      description: input.description,
      isUrgent,
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
      maxQuestions,
      usedFallback: true,
    };
  };

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[follow-up-interview] OPENAI_API_KEY not configured");
    if (isFirstStep && !existingScopeFit) {
      await saveQuoteRequestScopeAssessment(admin, input.requestId, heuristicScope, customerProblem);
    }
    return fallbackNext(scopeAssessment);
  }

  try {
    const userText = buildInterviewUserPrompt({
      tradeLabel,
      primaryTrade,
      primaryTradeOther,
      additionalTrades,
      customerProblem,
      scopeAssessment,
      projectType: input.projectType,
      description: input.description,
      isUrgent,
      photoCount: input.attachmentPaths.length,
      previousAnswers: input.previousAnswers,
      specialtyCatalogJson,
      remainingCatalogJson: remainingCatalog.length
        ? JSON.stringify(remainingCatalog)
        : null,
      allowTradeLibrary,
      questionNumber,
      maxQuestions,
      specialty,
    });

    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "low" } }
    > = [{ type: "text", text: userText }];

    if (input.attachmentPaths.length > 0) {
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
          {
            role: "system",
            content: buildInterviewSystemPrompt({
              isFirstStep,
              customerProblem,
              scopeFit: scopeAssessment.fit,
              isUrgent,
              allowTradeLibrary,
            }),
          },
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
        await saveQuoteRequestScopeAssessment(admin, input.requestId, heuristicScope, customerProblem);
      }
      return fallbackNext(scopeAssessment);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      if (isFirstStep && !existingScopeFit) {
        await saveQuoteRequestScopeAssessment(admin, input.requestId, heuristicScope, customerProblem);
      }
      return fallbackNext(scopeAssessment);
    }

    let parsed: AiInterviewStepResponse;
    try {
      parsed = JSON.parse(content) as AiInterviewStepResponse;
    } catch {
      if (isFirstStep && !existingScopeFit) {
        await saveQuoteRequestScopeAssessment(admin, input.requestId, heuristicScope, customerProblem);
      }
      return fallbackNext(scopeAssessment);
    }

    const resolvedProblem = normalizeCustomerProblem(parsed.customerProblem, customerProblem);

    if (isFirstStep && !existingScopeFit) {
      const scopeToSave = normalizeScopeAssessment(
        parsed.scopeAssessment,
        workScopeToScopeAssessment(
          assessScopeFromWork({
            customerProblem: resolvedProblem,
            tradeLabel,
            primaryTrade,
            primaryTradeOther,
            extraCapabilities,
            projectType: input.projectType,
            description: input.description,
            previousAnswers: input.previousAnswers,
          })
        )
      );
      await saveQuoteRequestScopeAssessment(
        admin,
        input.requestId,
        scopeToSave,
        resolvedProblem
      );
    }

    if (parsed.interview_complete === true) {
      return { status: "complete", usedFallback: false };
    }

    const scopeForFallback = normalizeScopeAssessment(
      parsed.scopeAssessment,
      workScopeToScopeAssessment(
        assessScopeFromWork({
          customerProblem: resolvedProblem,
          tradeLabel,
          primaryTrade,
          primaryTradeOther,
          extraCapabilities,
          projectType: input.projectType,
          description: input.description,
          previousAnswers: input.previousAnswers,
        })
      )
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
        maxQuestions,
        usedFallback: false,
      };
    }

    const libraryId = String(parsed.selected_library_question_id ?? "").trim();
    if (libraryId && !asked.has(libraryId)) {
      const blocked = shouldBlockInterviewQuestion({
        questionId: libraryId,
        scopeFit: scopeForFallback.fit,
        isUrgent,
        allowTradeLibrary,
        specialty,
        questionNumber,
      });
      if (!blocked) {
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
            maxQuestions,
            usedFallback: false,
          };
        }
      }
    }

    if (parsed.custom_question) {
      const custom = buildCustomFollowUpQuestion(
        parsed.custom_question,
        displayOrder,
        isUrgent
      );
      if (custom) {
        return {
          status: "question",
          question: custom,
          questionNumber,
          maxQuestions,
          usedFallback: false,
        };
      }
    }

    return fallbackNext(scopeForFallback);
  } catch (err) {
    console.error("[follow-up-interview] unexpected error", err);
    if (isFirstStep && !existingScopeFit) {
      await saveQuoteRequestScopeAssessment(admin, input.requestId, heuristicScope, customerProblem);
    }
    return fallbackNext(scopeAssessment);
  }
}
