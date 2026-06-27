import type { PreviousInterviewAnswer } from "@/lib/quote-requests/follow-up-types";
import { MAX_FOLLOW_UP_INTERVIEW_QUESTIONS } from "@/lib/quote-requests/follow-up-types";
import type { CustomerProblem } from "@/lib/quote-requests/problem-classification";
import type { ScopeFit } from "@/lib/quote-requests/scope-assessment";
import {
  BLOCKED_GENERIC_QUESTION_IDS,
  DEFERRED_UNTIL_LATER_IDS,
  isSpecialtyQuestionId,
} from "@/lib/quote-requests/specialty/registry";
import type { SpecialtyClassification } from "@/lib/quote-requests/specialty/types";

export const OUT_OF_SCOPE_MAX_QUESTIONS = 2;

/** Timing/readiness questions — blocked when customer marked urgent */
export const TIMING_READINESS_QUESTION_IDS = new Set([
  "shared_timeline_completion",
  "shared_move_forward",
  "shared_specific_date",
]);

const TIMING_READINESS_PHRASES =
  /\b(how soon|move forward|ready to hire|when would you (like|ideally)|start the work|begin the work|target date|gathering information)\b/i;

export function getInterviewQuestionLimit(scopeFit: ScopeFit): number {
  if (scopeFit === "outside_scope" || scopeFit === "possibly_out_of_scope") {
    return OUT_OF_SCOPE_MAX_QUESTIONS;
  }
  return MAX_FOLLOW_UP_INTERVIEW_QUESTIONS;
}

export function isLikelyOutOfScope(scopeFit: ScopeFit): boolean {
  return scopeFit === "outside_scope" || scopeFit === "possibly_out_of_scope";
}

/**
 * Whether trade-library questions may be offered this step.
 * Problem-first: never use contractor trade library by default for mixed/out-of-scope.
 */
export function allowProblemLibrary(
  scopeFit: ScopeFit,
  previousAnswers: PreviousInterviewAnswer[],
  customerProblem: CustomerProblem
): boolean {
  if (isLikelyOutOfScope(scopeFit)) {
    return false;
  }
  if (scopeFit === "mixed_scope") {
    return mixedScopeConfirmedInScope(previousAnswers, customerProblem);
  }
  return scopeFit === "within_scope";
}

export function mixedScopeConfirmedInScope(
  previousAnswers: PreviousInterviewAnswer[],
  customerProblem: CustomerProblem
): boolean {
  for (const a of previousAnswers) {
    const ans = (a.answer ?? "").toLowerCase();
    if (!ans || ans === "(skipped)") continue;

    if (customerProblem.key === "pool_installation") {
      if (
        ans.includes("landscaping around") ||
        ans.includes("around a pool") ||
        ans.includes("grading") ||
        ans.includes("drainage") ||
        ans.includes("patio") ||
        ans.includes("decking") ||
        ans.includes("retaining")
      ) {
        return true;
      }
    }

    if (customerProblem.key === "foundation_waterproofing") {
      if (
        ans.includes("interior crack") ||
        ans.includes("exterior waterproof") ||
        ans.includes("drainage/grading") ||
        ans.includes("drainage") ||
        ans.includes("grading")
      ) {
        return true;
      }
    }

    if (customerProblem.key === "exterior_drainage") {
      if (
        ans.includes("grading") ||
        ans.includes("drainage") ||
        ans.includes("drainage/grading") ||
        ans.includes("exterior")
      ) {
        return true;
      }
    }

    if (customerProblem.key === "concrete") {
      if (!ans.includes("not sure") && !ans.includes("outside")) {
        return true;
      }
    }

    if (
      ans.includes("yes") &&
      (a.question.toLowerCase().includes("part of") ||
        a.question.toLowerCase().includes("looking for help"))
    ) {
      return true;
    }
  }
  return false;
}

export function mixedScopeConfirmedOutside(
  previousAnswers: PreviousInterviewAnswer[],
  customerProblem: CustomerProblem
): boolean {
  for (const a of previousAnswers) {
    const ans = (a.answer ?? "").toLowerCase();
    if (!ans || ans === "(skipped)") continue;

    if (customerProblem.key === "pool_installation" && ans.includes("full pool installation")) {
      return true;
    }

    if (
      ans.includes("outside") ||
      ans.includes("specialist") ||
      ans.includes("different contractor") ||
      ans.includes("not this contractor")
    ) {
      return true;
    }

    if (
      a.question.toLowerCase().includes("outside the contractor") &&
      ans.length > 10 &&
      !ans.includes("grading") &&
      !ans.includes("landscaping")
    ) {
      return true;
    }
  }
  return false;
}

export function shouldStopInterview(input: {
  answeredCount: number;
  scopeFit: ScopeFit;
  isUrgent: boolean;
  previousAnswers: PreviousInterviewAnswer[];
  customerProblem: CustomerProblem;
  specialty: SpecialtyClassification | null;
}): boolean {
  const limit = getInterviewQuestionLimit(input.scopeFit);
  if (input.answeredCount >= limit) {
    return true;
  }

  if (
    input.scopeFit === "mixed_scope" &&
    mixedScopeConfirmedOutside(input.previousAnswers, input.customerProblem) &&
    input.answeredCount >= 1
  ) {
    return true;
  }

  if (
    isLikelyOutOfScope(input.scopeFit) &&
    input.answeredCount >= OUT_OF_SCOPE_MAX_QUESTIONS
  ) {
    return true;
  }

  return false;
}

export function isTimingReadinessQuestion(
  questionId: string | null | undefined,
  questionText: string
): boolean {
  if (questionId && TIMING_READINESS_QUESTION_IDS.has(questionId)) {
    return true;
  }
  return TIMING_READINESS_PHRASES.test(questionText);
}

export function shouldBlockInterviewQuestion(input: {
  questionId: string;
  scopeFit: ScopeFit;
  isUrgent: boolean;
  allowTradeLibrary: boolean;
  specialty: SpecialtyClassification | null;
  questionNumber: number;
}): boolean {
  if (isSpecialtyQuestionId(input.questionId)) {
    return false;
  }

  if (!input.allowTradeLibrary && !input.questionId.startsWith("specialty_")) {
    const isShared = input.questionId.startsWith("shared_");
    const isTrade =
      !isShared &&
      !input.questionId.startsWith("specialty_") &&
      !input.questionId.startsWith("other_");
    if (isTrade) {
      return true;
    }
  }

  if (input.isUrgent && TIMING_READINESS_QUESTION_IDS.has(input.questionId)) {
    return true;
  }

  if (isLikelyOutOfScope(input.scopeFit)) {
    return true;
  }

  if (BLOCKED_GENERIC_QUESTION_IDS.has(input.questionId)) {
    return true;
  }

  if (input.specialty) {
    if (
      input.specialty.urgent &&
      input.questionNumber <= 4 &&
      DEFERRED_UNTIL_LATER_IDS.has(input.questionId)
    ) {
      return true;
    }
    if (
      input.specialty.key === "foundation_waterproofing" &&
      input.questionId.startsWith("landscaping_") &&
      input.questionId !== "landscaping_site_access"
    ) {
      return true;
    }
  }

  if (input.isUrgent && DEFERRED_UNTIL_LATER_IDS.has(input.questionId)) {
    return true;
  }

  return false;
}

export function filterProblemRelevantCatalog(
  catalog: Array<{ id: string }>,
  input: {
    scopeFit: ScopeFit;
    isUrgent: boolean;
    allowTradeLibrary: boolean;
    specialty: SpecialtyClassification | null;
    questionNumber: number;
  }
): Array<{ id: string }> {
  return catalog.filter(
    (q) =>
      !shouldBlockInterviewQuestion({
        questionId: q.id,
        scopeFit: input.scopeFit,
        isUrgent: input.isUrgent,
        allowTradeLibrary: input.allowTradeLibrary,
        specialty: input.specialty,
        questionNumber: input.questionNumber,
      })
  );
}

export function isBlockedCustomQuestionText(question: string, isUrgent: boolean): boolean {
  if (!isUrgent) return false;
  return isTimingReadinessQuestion(null, question);
}
