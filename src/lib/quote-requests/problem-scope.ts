import type { CustomerProblem } from "@/lib/quote-requests/problem-classification";
import type { ScopeAssessment } from "@/lib/quote-requests/scope-assessment";

function tradeLower(tradeLabel: string | null, primaryTrade: string | null): string {
  return (tradeLabel ?? primaryTrade ?? "").toLowerCase();
}

function isLandscaper(trade: string): boolean {
  return trade.includes("landscap");
}

function isConcreteOrRenovator(trade: string): boolean {
  return trade.includes("concrete") || trade.includes("renovat");
}

function isHandyman(trade: string): boolean {
  return trade.includes("handyman");
}

function isPlumber(trade: string): boolean {
  return trade.includes("plumb");
}

function isRoofer(trade: string): boolean {
  return trade.includes("roof");
}

function isPainter(trade: string): boolean {
  return trade.includes("paint");
}

function isElectrician(trade: string): boolean {
  return trade.includes("electric");
}

function isHvac(trade: string): boolean {
  return trade.includes("hvac");
}

function isFlooring(trade: string): boolean {
  return trade.includes("floor");
}

function isDeckFence(trade: string): boolean {
  return trade.includes("deck") || trade.includes("fence");
}

function isMismatchedSpecialtyTrade(trade: string): boolean {
  return isPainter(trade) || isRoofer(trade) || isHvac(trade) || isElectrician(trade);
}

function defaultWithinScope(tradeLabel: string | null): ScopeAssessment {
  const trade = tradeLabel?.trim() || "contractor";
  return {
    fit: "within_scope",
    reason: `Request appears related to ${trade} work.`,
    contractorNote: `Detected customer problem appears to fit typical ${trade} projects. Review details to confirm.`,
    customerClarificationNeeded: false,
  };
}

/**
 * Compare the customer's actual problem against the contractor's trade.
 * This runs AFTER problem classification — never assume the contractor trade first.
 */
export function assessScopeFit(input: {
  customerProblem: CustomerProblem;
  tradeLabel: string | null;
  primaryTrade: string | null;
}): ScopeAssessment {
  const trade = tradeLower(input.tradeLabel, input.primaryTrade);
  const problem = input.customerProblem;

  switch (problem.key) {
    case "foundation_waterproofing": {
      if (isLandscaper(trade)) {
        return {
          fit: "mixed_scope",
          reason:
            "Basement/foundation leak may need waterproofing; landscaper may only handle exterior drainage/grading.",
          contractorNote: `Customer problem: ${problem.label}. This may require waterproofing or foundation repair. Review whether you handle that or only exterior grading/drainage around the foundation.`,
          customerClarificationNeeded: true,
        };
      }
      if (isConcreteOrRenovator(trade) || isHandyman(trade)) {
        return {
          fit: "within_scope",
          reason: "Foundation crack or basement leak repair appears related to this contractor's work.",
          contractorNote: `Customer problem: ${problem.label}. Confirm your waterproofing/repair services and whether interior or exterior work is needed.`,
          customerClarificationNeeded: false,
        };
      }
      if (isMismatchedSpecialtyTrade(trade)) {
        return {
          fit: "outside_scope",
          reason: "Foundation waterproofing is not typical for this contractor trade.",
          contractorNote: `Customer problem: ${problem.label}. This is likely outside your listed trade. Review whether any related work applies.`,
          customerClarificationNeeded: true,
        };
      }
      break;
    }

    case "exterior_drainage": {
      if (isLandscaper(trade)) {
        return {
          fit: "within_scope",
          reason: "Exterior drainage and grading near the foundation fits landscaping work.",
          contractorNote: `Customer problem: ${problem.label}. This may involve grading, swales, downspout routing, or exterior drainage — confirm your services match.`,
          customerClarificationNeeded: false,
        };
      }
      if (isConcreteOrRenovator(trade) || isHandyman(trade)) {
        return {
          fit: "mixed_scope",
          reason: "Exterior drainage may involve grading specialists or general contractors.",
          contractorNote: `Customer problem: ${problem.label}. Review whether you handle grading/drainage or primarily structural/waterproofing work.`,
          customerClarificationNeeded: true,
        };
      }
      if (isMismatchedSpecialtyTrade(trade)) {
        return {
          fit: "possibly_out_of_scope",
          reason: "Exterior drainage work may be outside this contractor's listed trade.",
          contractorNote: `Customer problem: ${problem.label}. Confirm whether drainage or grading work is within your scope.`,
          customerClarificationNeeded: true,
        };
      }
      break;
    }

    case "pool_installation": {
      if (isLandscaper(trade)) {
        return {
          fit: "mixed_scope",
          reason: "Customer mentioned pool installation; may include specialist and landscaping work.",
          contractorNote: `Customer problem: ${problem.label}. Review whether you install pools or only handle grading, patio, decking, drainage, retaining walls, or landscaping around a pool.`,
          customerClarificationNeeded: true,
        };
      }
      if (isPainter(trade) || isPlumber(trade) || isRoofer(trade)) {
        return {
          fit: "outside_scope",
          reason: "Pool installation is not typical for this contractor trade.",
          contractorNote: `Customer problem: ${problem.label}. The customer may need a pool specialist. Review whether any related work applies.`,
          customerClarificationNeeded: true,
        };
      }
      return {
        fit: "possibly_out_of_scope",
        reason: "Pool installation may require specialized contractors.",
        contractorNote: `Customer problem: ${problem.label}. Confirm whether any part of this work fits your services.`,
        customerClarificationNeeded: true,
      };
    }

    case "landscaping": {
      if (isLandscaper(trade)) {
        return {
          fit: "within_scope",
          reason: "Landscaping request fits this contractor's listed trade.",
          contractorNote: `Customer problem: ${problem.label}. This appears to be a standard landscaping project.`,
          customerClarificationNeeded: false,
        };
      }
      if (isPlumber(trade) || isRoofer(trade) || isPainter(trade) || isElectrician(trade)) {
        return {
          fit: "outside_scope",
          reason: "Landscaping is not typical for this contractor trade.",
          contractorNote: `Customer problem: ${problem.label}. This appears outside your listed trade.`,
          customerClarificationNeeded: true,
        };
      }
      break;
    }

    case "roofing": {
      if (isRoofer(trade)) return defaultWithinScope(input.tradeLabel);
      if (isLandscaper(trade) || isPainter(trade) || isPlumber(trade)) {
        return {
          fit: "outside_scope",
          reason: "Roofing is not typical for this contractor trade.",
          contractorNote: `Customer problem: ${problem.label}. The customer likely needs a roofer.`,
          customerClarificationNeeded: true,
        };
      }
      break;
    }

    case "painting": {
      if (isPainter(trade)) return defaultWithinScope(input.tradeLabel);
      if (isPlumber(trade) || isRoofer(trade) || isLandscaper(trade)) {
        return {
          fit: "outside_scope",
          reason: "Painting is not typical for this contractor trade.",
          contractorNote: `Customer problem: ${problem.label}. This appears outside your listed trade.`,
          customerClarificationNeeded: true,
        };
      }
      break;
    }

    case "plumbing": {
      if (isPlumber(trade) || isHandyman(trade)) return defaultWithinScope(input.tradeLabel);
      if (isLandscaper(trade) || isPainter(trade) || isRoofer(trade)) {
        return {
          fit: "outside_scope",
          reason: "Plumbing is not typical for this contractor trade.",
          contractorNote: `Customer problem: ${problem.label}. The customer likely needs a plumber.`,
          customerClarificationNeeded: true,
        };
      }
      break;
    }

    case "electrical": {
      if (isElectrician(trade)) return defaultWithinScope(input.tradeLabel);
      if (isHandyman(trade)) {
        return {
          fit: "possibly_out_of_scope",
          reason: "Electrical work may require a licensed electrician.",
          contractorNote: `Customer problem: ${problem.label}. Review whether this is within your scope or requires an electrician.`,
          customerClarificationNeeded: true,
        };
      }
      if (isLandscaper(trade) || isPainter(trade) || isPlumber(trade)) {
        return {
          fit: "outside_scope",
          reason: "Electrical work is not typical for this contractor trade.",
          contractorNote: `Customer problem: ${problem.label}. The customer likely needs an electrician.`,
          customerClarificationNeeded: true,
        };
      }
      break;
    }

    case "hvac": {
      if (isHvac(trade)) return defaultWithinScope(input.tradeLabel);
      if (isHandyman(trade)) {
        return {
          fit: "possibly_out_of_scope",
          reason: "HVAC work may require a licensed HVAC technician.",
          contractorNote: `Customer problem: ${problem.label}. Review whether this is within your scope.`,
          customerClarificationNeeded: true,
        };
      }
      break;
    }

    case "tree_removal": {
      if (isLandscaper(trade)) return defaultWithinScope(input.tradeLabel);
      if (isPlumber(trade)) {
        return {
          fit: "outside_scope",
          reason: "Tree removal is not typical plumbing work.",
          contractorNote: `Customer problem: ${problem.label}. This appears outside your listed trade.`,
          customerClarificationNeeded: true,
        };
      }
      break;
    }

    case "kitchen_renovation":
    case "bathroom_renovation":
    case "general_renovation": {
      if (isConcreteOrRenovator(trade) || isHandyman(trade)) {
        return defaultWithinScope(input.tradeLabel);
      }
      if (isLandscaper(trade) || isPainter(trade) || isPlumber(trade) || isRoofer(trade)) {
        return {
          fit: "possibly_out_of_scope",
          reason: "Renovation work may be outside this contractor's primary focus.",
          contractorNote: `Customer problem: ${problem.label}. Confirm whether this renovation fits your services.`,
          customerClarificationNeeded: true,
        };
      }
      break;
    }

    case "concrete": {
      if (isConcreteOrRenovator(trade) || isHandyman(trade)) {
        return defaultWithinScope(input.tradeLabel);
      }
      if (isLandscaper(trade)) {
        return {
          fit: "mixed_scope",
          reason: "Concrete work may overlap with landscaping hardscape or be a separate specialty.",
          contractorNote: `Customer problem: ${problem.label}. Review whether you handle concrete flatwork or only landscaping.`,
          customerClarificationNeeded: true,
        };
      }
      break;
    }

    case "flooring": {
      if (isFlooring(trade) || isHandyman(trade) || isConcreteOrRenovator(trade)) {
        return defaultWithinScope(input.tradeLabel);
      }
      break;
    }

    case "deck_fence": {
      if (isDeckFence(trade) || isHandyman(trade) || isConcreteOrRenovator(trade)) {
        return defaultWithinScope(input.tradeLabel);
      }
      break;
    }
  }

  if (problem.confidence === "low") {
    return {
      fit: "possibly_out_of_scope",
      reason: "Could not confidently match the request to this contractor's trade.",
      contractorNote: `Customer problem: ${problem.label}. ${problem.reasoning} Review whether this request fits your services.`,
      customerClarificationNeeded: true,
    };
  }

  return defaultWithinScope(input.tradeLabel);
}
