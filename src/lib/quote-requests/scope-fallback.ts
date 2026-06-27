import type { FollowUpQuestion } from "@/lib/quote-requests/follow-up-types";
import type { ScopeAssessment, ScopeFit } from "@/lib/quote-requests/scope-assessment";
import { detectSpecialty } from "@/lib/quote-requests/specialty/detection";
import { inferSpecialtyScopeAssessment } from "@/lib/quote-requests/specialty/scope";
import { generateUUID } from "@/lib/utils/uuid";

const POOL_PATTERN = /\bpool\b|\bswimming pool\b|\binground pool\b|\babove[- ]ground pool\b/i;
const SOD_PATTERN = /\bsod\b|\bturf\b|\blawn install|\bnew lawn\b/i;
const ELECTRICAL_PANEL_PATTERN =
  /\belectrical panel\b|\bservice panel\b|\bbreaker panel\b|\b200 amp\b/i;
const TREE_REMOVAL_PATTERN = /\btree removal\b|\btree remov|\bstump grind/i;

function combinedText(projectType: string, description: string): string {
  return `${projectType} ${description}`.toLowerCase();
}

function defaultWithinScope(tradeLabel: string | null): ScopeAssessment {
  const trade = tradeLabel?.trim() || "contractor";
  return {
    fit: "within_scope",
    reason: `Request appears related to ${trade} work.`,
    contractorNote: `This request appears to fit typical ${trade} projects. Review details to confirm.`,
    customerClarificationNeeded: false,
  };
}

export function inferHeuristicScopeAssessment(input: {
  tradeLabel: string | null;
  primaryTrade: string | null;
  projectType: string;
  description: string;
}): ScopeAssessment {
  const text = combinedText(input.projectType, input.description);
  const specialty = detectSpecialty(input.projectType, input.description);
  if (specialty) {
    return inferSpecialtyScopeAssessment(
      specialty,
      input.tradeLabel,
      input.primaryTrade
    );
  }

  const trade = (input.tradeLabel ?? input.primaryTrade ?? "").toLowerCase();
  const isLandscaper = trade.includes("landscap");
  const isPainter = trade.includes("paint");
  const isPlumber = trade.includes("plumb");
  const isRoofer = trade.includes("roof");
  const isHandyman = trade.includes("handyman");

  if (POOL_PATTERN.test(text)) {
    if (isLandscaper) {
      return {
        fit: "mixed_scope",
        reason: "Customer mentioned pool installation; may include specialist and landscaping work.",
        contractorNote:
          "This request may include work outside a typical landscaping project. The customer appears to be asking about pool installation. Review whether you install pools or only handle grading, patio, decking, drainage, retaining walls, or landscaping around a pool.",
        customerClarificationNeeded: true,
      };
    }
    if (isPainter || isPlumber || isRoofer) {
      return {
        fit: "outside_scope",
        reason: "Pool installation is not typical for this contractor trade.",
        contractorNote:
          "This request appears to be for pool installation, which is outside this contractor's listed trade. The customer may need a pool specialist. Review whether any related work applies.",
        customerClarificationNeeded: true,
      };
    }
    return {
      fit: "possibly_out_of_scope",
      reason: "Pool installation may require specialized contractors.",
      contractorNote:
        "The customer mentioned pool installation. Confirm whether any part of this work fits your services.",
      customerClarificationNeeded: true,
    };
  }

  if (ELECTRICAL_PANEL_PATTERN.test(text) && isHandyman) {
    return {
      fit: "possibly_out_of_scope",
      reason: "Electrical panel work may require a licensed electrician.",
      contractorNote:
        "This project may involve specialized electrical work such as a panel replacement. Review whether this is within your scope or requires an electrician.",
      customerClarificationNeeded: true,
    };
  }

  if (TREE_REMOVAL_PATTERN.test(text) && isPlumber) {
    return {
      fit: "outside_scope",
      reason: "Tree removal is not typical plumbing work.",
      contractorNote:
        "The customer appears to be asking about tree removal, which is outside this contractor's listed trade.",
      customerClarificationNeeded: true,
    };
  }

  if (SOD_PATTERN.test(text) && isLandscaper) {
    return {
      fit: "within_scope",
      reason: "Sod or lawn installation fits typical landscaping work.",
      contractorNote: "This request appears to be a standard landscaping project such as sod or lawn installation.",
      customerClarificationNeeded: false,
    };
  }

  return defaultWithinScope(input.tradeLabel);
}

export function getScopeFallbackCustomQuestions(
  scope: ScopeAssessment,
  projectType: string,
  description: string
): FollowUpQuestion[] {
  const text = combinedText(projectType, description);

  if (scope.fit === "mixed_scope" && POOL_PATTERN.test(text)) {
    return [
      {
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
        display_order: 1,
      },
      {
        id: generateUUID(),
        question: "Is this an inground pool or above-ground pool?",
        question_type: "multiple_choice",
        options: ["Inground", "Above-ground", "Not sure"],
        display_order: 2,
      },
      {
        id: generateUUID(),
        question: "Do you already have a pool selected or quoted?",
        question_type: "yes_no",
        display_order: 3,
      },
      {
        id: generateUUID(),
        question: "Is there machine access to the backyard?",
        question_type: "yes_no",
        display_order: 4,
      },
      {
        id: generateUUID(),
        question:
          "Will this include patio, decking, retaining walls, grading, or landscaping?",
        question_type: "checkbox",
        options: [
          "Patio",
          "Decking",
          "Retaining walls",
          "Grading",
          "Landscaping",
          "None of these",
        ],
        display_order: 5,
      },
      {
        id: generateUUID(),
        question: "When would you ideally like the pool ready to use?",
        question_type: "multiple_choice",
        options: [
          "As soon as possible",
          "Within 1 month",
          "Within 2–3 months",
          "This season",
          "I'm flexible",
        ],
        display_order: 6,
      },
    ];
  }

  if (scope.fit === "possibly_out_of_scope") {
    return [
      {
        id: generateUUID(),
        question:
          "This project may involve specialized work. What part of the project are you looking for help with?",
        question_type: "short_text",
        display_order: 1,
      },
      {
        id: generateUUID(),
        question: "When would you ideally like this project to be completed?",
        question_type: "multiple_choice",
        options: [
          "As soon as possible",
          "Within 1 month",
          "Within 2–3 months",
          "This season",
          "I'm flexible",
        ],
        display_order: 2,
      },
    ];
  }

  if (scope.fit === "outside_scope") {
    return [
      {
        id: generateUUID(),
        question:
          "This may be outside the contractor's listed trade. Could you briefly describe what part of the project you are hoping they can help with?",
        question_type: "short_text",
        display_order: 1,
      },
      {
        id: generateUUID(),
        question: "How soon are you hoping to move forward?",
        question_type: "multiple_choice",
        options: [
          "Ready to hire now",
          "Within the next month",
          "Within the next 3 months",
          "Just gathering information",
        ],
        display_order: 2,
      },
    ];
  }

  return [];
}

export function libraryLimitForScope(scopeFit: ScopeFit): number {
  switch (scopeFit) {
    case "within_scope":
      return 8;
    case "mixed_scope":
      return 4;
    case "possibly_out_of_scope":
      return 2;
    case "outside_scope":
      return 0;
  }
}

export function customLimitForScope(scopeFit: ScopeFit): number {
  switch (scopeFit) {
    case "within_scope":
      return 5;
    case "mixed_scope":
      return 6;
    case "possibly_out_of_scope":
      return 4;
    case "outside_scope":
      return 3;
  }
}

export function totalLimitForScope(scopeFit: ScopeFit): number {
  switch (scopeFit) {
    case "within_scope":
      return 8;
    case "mixed_scope":
      return 8;
    case "possibly_out_of_scope":
      return 6;
    case "outside_scope":
      return 3;
  }
}

export function minQuestionsForScope(scopeFit: ScopeFit): number {
  return scopeFit === "outside_scope" ? 1 : 3;
}
