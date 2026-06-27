import type { ScopeAssessment } from "@/lib/quote-requests/scope-assessment";
import type { SpecialtyClassification } from "@/lib/quote-requests/specialty/types";

function tradeLower(tradeLabel: string | null, primaryTrade: string | null): string {
  return (tradeLabel ?? primaryTrade ?? "").toLowerCase();
}

function isConcreteOrRenovator(trade: string): boolean {
  return trade.includes("concrete") || trade.includes("renovat");
}

function isHandyman(trade: string): boolean {
  return trade.includes("handyman");
}

function isLandscaper(trade: string): boolean {
  return trade.includes("landscap");
}

function isMismatchedTrade(trade: string): boolean {
  return (
    trade.includes("paint") ||
    trade.includes("roof") ||
    trade.includes("hvac") ||
    trade.includes("electric")
  );
}

/**
 * Scope assessment when a foundation/drainage specialty is detected.
 */
export function inferSpecialtyScopeAssessment(
  specialty: SpecialtyClassification,
  tradeLabel: string | null,
  primaryTrade: string | null
): ScopeAssessment {
  const trade = tradeLower(tradeLabel, primaryTrade);

  if (specialty.key === "exterior_drainage") {
    if (isLandscaper(trade)) {
      return {
        fit: "within_scope",
        reason: "Exterior drainage and grading near the foundation fits landscaping work.",
        contractorNote:
          "The customer described exterior water pooling or drainage near the foundation. This may involve grading, swales, downspout routing, or exterior drainage — confirm your services match.",
        customerClarificationNeeded: false,
      };
    }
    if (isConcreteOrRenovator(trade) || isHandyman(trade)) {
      return {
        fit: "mixed_scope",
        reason: "Exterior drainage may involve grading specialists or general contractors.",
        contractorNote:
          "The customer needs exterior drainage or grading help near the foundation. Review whether you handle grading/drainage or primarily structural/waterproofing work.",
        customerClarificationNeeded: true,
      };
    }
    if (isMismatchedTrade(trade)) {
      return {
        fit: "possibly_out_of_scope",
        reason: "Exterior drainage work may be outside this contractor's listed trade.",
        contractorNote:
          "The customer described exterior water pooling near the foundation. Confirm whether drainage or grading work is within your scope.",
        customerClarificationNeeded: true,
      };
    }
  }

  if (specialty.key === "foundation_waterproofing") {
    if (isLandscaper(trade)) {
      return {
        fit: "mixed_scope",
        reason:
          "Basement/foundation leak may need waterproofing; landscaper may only handle exterior drainage/grading.",
        contractorNote:
          "The customer described a foundation crack or basement leak. Review whether you handle waterproofing or only exterior grading/drainage around the foundation.",
        customerClarificationNeeded: true,
      };
    }
    if (isConcreteOrRenovator(trade) || isHandyman(trade)) {
      return {
        fit: "within_scope",
        reason: "Foundation crack or basement leak repair appears related to this contractor's work.",
        contractorNote:
          "The customer described foundation cracking, basement leaking, or water intrusion. Confirm your waterproofing/repair services and whether interior or exterior work is needed.",
        customerClarificationNeeded: false,
      };
    }
    if (isMismatchedTrade(trade)) {
      return {
        fit: "outside_scope",
        reason: "Foundation waterproofing is not typical for this contractor trade.",
        contractorNote:
          "The customer described a foundation or basement water issue, which is likely outside this contractor's listed trade. Review whether any related work applies.",
        customerClarificationNeeded: true,
      };
    }
  }

  return {
    fit: "possibly_out_of_scope",
    reason: `${specialty.label} may require a specialist — confirm this fits your services.`,
    contractorNote: `The customer described ${specialty.label.toLowerCase()}. Review whether this project matches your services.`,
    customerClarificationNeeded: true,
  };
}
