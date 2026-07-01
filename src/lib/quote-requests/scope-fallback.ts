import type { FollowUpQuestion } from "@/lib/quote-requests/follow-up-types";
import type { CustomerProblem } from "@/lib/quote-requests/problem-classification";
import { classifyCustomerProblem } from "@/lib/quote-requests/problem-classification";
import { assessScopeFit } from "@/lib/quote-requests/problem-scope";
import type { ScopeAssessment, ScopeFit } from "@/lib/quote-requests/scope-assessment";
import { generateUUID } from "@/lib/utils/uuid";
import type { PreviousInterviewAnswer } from "@/lib/quote-requests/follow-up-types";
import {
  mixedScopeConfirmedOutside,
  OUT_OF_SCOPE_MAX_QUESTIONS,
} from "@/lib/quote-requests/interview-policy";

const POOL_PATTERN = /\bpool\b|\bswimming pool\b|\binground pool\b|\babove[- ]ground pool\b/i;

export function inferHeuristicScopeAssessment(input: {
  tradeLabel: string | null;
  primaryTrade: string | null;
  primaryTradeOther?: string | null;
  additionalTrades?: string[] | null;
  extraCapabilities?: string | null;
  projectType: string;
  description: string;
}): ScopeAssessment {
  const customerProblem = classifyCustomerProblem(input.projectType, input.description);
  return assessScopeFit({
    customerProblem,
    tradeLabel: input.tradeLabel,
    primaryTrade: input.primaryTrade,
    primaryTradeOther: input.primaryTradeOther ?? null,
    additionalTrades: input.additionalTrades ?? null,
    extraCapabilities: input.extraCapabilities ?? null,
    projectType: input.projectType,
    description: input.description,
  });
}

function urgentFollowUpQuestion(displayOrder: number): FollowUpQuestion {
  return {
    id: generateUUID(),
    question:
      "Is there an active safety issue, ongoing damage, or immediate access concern the contractor should know about?",
    question_type: "multiple_choice",
    options: [
      "Yes — active safety or damage issue",
      "Yes — need access arranged urgently",
      "No — but it is time-sensitive",
      "Not sure",
    ],
    display_order: displayOrder,
    is_custom: true,
  };
}

function mixedScopeFirstQuestion(
  customerProblem: CustomerProblem,
  displayOrder: number
): FollowUpQuestion {
  if (customerProblem.key === "pool_installation") {
    return {
      id: generateUUID(),
      question:
        "Are you looking for full pool installation, or work around the pool area?",
      question_type: "multiple_choice",
      options: [
        "Full pool installation",
        "Patio, decking, or landscaping around a pool",
        "Grading or drainage preparation",
        "Landscaping around an existing pool",
        "Not sure",
      ],
      display_order: displayOrder,
      is_custom: true,
    };
  }

  if (customerProblem.key === "foundation_waterproofing") {
    return {
      id: generateUUID(),
      question:
        "Are you looking for interior crack repair, exterior waterproofing, or drainage/grading help?",
      question_type: "multiple_choice",
      options: [
        "Interior crack repair",
        "Exterior waterproofing",
        "Drainage/grading help",
        "Not sure",
      ],
      display_order: displayOrder,
      is_custom: true,
    };
  }

  if (customerProblem.key === "concrete") {
    return {
      id: generateUUID(),
      question:
        "Is this concrete flatwork (driveway, sidewalk, patio) or part of a larger landscaping/hardscape project?",
      question_type: "multiple_choice",
      options: [
        "Concrete flatwork only",
        "Part of landscaping or hardscape",
        "Not sure",
      ],
      display_order: displayOrder,
      is_custom: true,
    };
  }

  return {
    id: generateUUID(),
    question:
      "Which part of this project are you hoping this contractor can help with?",
    question_type: "short_text",
    display_order: displayOrder,
    is_custom: true,
  };
}

/**
 * Returns the next scope-clarification question (one at a time), or null when done.
 */
export function getNextScopeFallbackQuestion(input: {
  scope: ScopeAssessment;
  customerProblem: CustomerProblem;
  projectType: string;
  description: string;
  isUrgent: boolean;
  previousAnswers: PreviousInterviewAnswer[];
  displayOrder: number;
}): FollowUpQuestion | null {
  const answeredCount = input.previousAnswers.length;
  const text = `${input.projectType} ${input.description}`.toLowerCase();

  if (
    input.scope.fit === "mixed_scope" &&
    mixedScopeConfirmedOutside(input.previousAnswers, input.customerProblem)
  ) {
    return null;
  }

  if (input.scope.fit === "mixed_scope" && answeredCount === 0) {
    return mixedScopeFirstQuestion(input.customerProblem, input.displayOrder);
  }

  if (input.scope.fit === "mixed_scope" && POOL_PATTERN.test(text) && answeredCount === 1) {
    const firstAnswer = (input.previousAnswers[0]?.answer ?? "").toLowerCase();
    if (firstAnswer.includes("full pool installation")) {
      return null;
    }
    if (
      firstAnswer.includes("landscaping") ||
      firstAnswer.includes("grading") ||
      firstAnswer.includes("patio") ||
      firstAnswer.includes("decking")
    ) {
      return {
        id: generateUUID(),
        question: "Is there machine access to the backyard for equipment?",
        question_type: "yes_no",
        display_order: input.displayOrder,
        is_custom: true,
      };
    }
  }

  if (
    input.scope.fit === "possibly_out_of_scope" ||
    input.scope.fit === "outside_scope"
  ) {
    if (answeredCount >= OUT_OF_SCOPE_MAX_QUESTIONS) {
      return null;
    }

    if (answeredCount === 0) {
      return {
        id: generateUUID(),
        question:
          input.scope.fit === "outside_scope"
            ? "This may be outside the contractor's listed trade. Could you briefly describe what part of the project you are hoping they can help with?"
            : "This project may involve specialized work. What part of the project are you looking for help with?",
        question_type: "short_text",
        display_order: input.displayOrder,
        is_custom: true,
      };
    }

    if (answeredCount === 1) {
      if (input.isUrgent) {
        return urgentFollowUpQuestion(input.displayOrder);
      }
      return {
        id: generateUUID(),
        question: "Is there anything else that would help the contractor assess this request?",
        question_type: "short_text",
        display_order: input.displayOrder,
        is_custom: true,
      };
    }
  }

  return null;
}

/** @deprecated Use getNextScopeFallbackQuestion */
export function getScopeFallbackCustomQuestions(
  scope: ScopeAssessment,
  projectType: string,
  description: string
): FollowUpQuestion[] {
  const customerProblem = classifyCustomerProblem(projectType, description);
  const first = getNextScopeFallbackQuestion({
    scope,
    customerProblem,
    projectType,
    description,
    isUrgent: false,
    previousAnswers: [],
    displayOrder: 1,
  });
  return first ? [first] : [];
}

export function libraryLimitForScope(scopeFit: ScopeFit): number {
  switch (scopeFit) {
    case "within_scope":
      return 8;
    case "mixed_scope":
      return 4;
    case "possibly_out_of_scope":
      return 0;
    case "outside_scope":
      return 0;
  }
}

export function customLimitForScope(scopeFit: ScopeFit): number {
  switch (scopeFit) {
    case "within_scope":
      return 5;
    case "mixed_scope":
      return 3;
    case "possibly_out_of_scope":
      return OUT_OF_SCOPE_MAX_QUESTIONS;
    case "outside_scope":
      return OUT_OF_SCOPE_MAX_QUESTIONS;
  }
}

export function totalLimitForScope(scopeFit: ScopeFit): number {
  switch (scopeFit) {
    case "within_scope":
      return 8;
    case "mixed_scope":
      return 6;
    case "possibly_out_of_scope":
      return OUT_OF_SCOPE_MAX_QUESTIONS;
    case "outside_scope":
      return OUT_OF_SCOPE_MAX_QUESTIONS;
  }
}

export function minQuestionsForScope(scopeFit: ScopeFit): number {
  return scopeFit === "outside_scope" ? 1 : 3;
}
