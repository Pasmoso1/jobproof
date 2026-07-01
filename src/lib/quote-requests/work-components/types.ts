import type { ProblemConfidence } from "@/lib/quote-requests/problem-classification";

/** Individual work required to complete a project */
export const WORK_COMPONENT_KEYS = [
  "demolition",
  "removal",
  "excavation",
  "grading",
  "drainage",
  "framing",
  "concrete",
  "masonry",
  "painting",
  "drywall",
  "plumbing",
  "electrical",
  "hvac",
  "roofing",
  "flooring",
  "waterproofing",
  "landscaping",
  "fencing",
  "decking",
  "finish_carpentry",
  "pool_installation",
  "kitchen_renovation",
  "bathroom_renovation",
  "windows_doors",
  "tile",
  "cabinetry",
  "insulation",
  "general_renovation",
] as const;

export type WorkComponentKey = (typeof WORK_COMPONENT_KEYS)[number];

export type ComponentCapability =
  | "clearly_performs"
  | "may_perform"
  | "unlikely_to_perform";

/**
 * Contractor business profile for scope matching and AI context.
 * Extend with service radius, commercial/residential flags, licensed trades, etc.
 */
export type ContractorCapabilityProfile = {
  primaryTrade: string | null;
  primaryTradeOther: string | null;
  tradeLabel: string | null;
  additionalTrades?: string[];
  /** Future: explicit services offered */
  servicesOffered?: string[];
  /** Future: explicit services not offered */
  servicesNotOffered?: string[];
  /** Future: licenses / certifications */
  certifications?: string[];
  /** Future: specialty focus areas */
  specialties?: string[];
  /** Future: service radius, commercial-only, residential-only, emergency service */
  /** Contractor free-text: supporting services beyond listed trades */
  extraCapabilities?: string | null;
};

export type WorkComponentMatch = {
  key: WorkComponentKey;
  label: string;
  capability: ComponentCapability;
  /** Trade that typically performs this work when contractor may not */
  typicalSpecialist?: string;
};

export type WorkScopeAnalysis = {
  customerProblemLabel: string;
  workComponents: WorkComponentMatch[];
  specialistTrades: string[];
  confidence: ProblemConfidence;
  fit: import("@/lib/quote-requests/scope-assessment").ScopeFit;
  reason: string;
  contractorNote: string;
  customerClarificationNeeded: boolean;
  /** Internal summary for debugging — not shown to customer */
  matchSummary: string;
};

export type StoredWorkComponent = {
  key: WorkComponentKey;
  label: string;
  capability: ComponentCapability;
  typicalSpecialist?: string;
};

export function isWorkComponentKey(value: string): value is WorkComponentKey {
  return (WORK_COMPONENT_KEYS as readonly string[]).includes(value);
}

export function isComponentCapability(value: string): value is ComponentCapability {
  return (
    value === "clearly_performs" ||
    value === "may_perform" ||
    value === "unlikely_to_perform"
  );
}

export function isScopeConfidence(value: string): value is ProblemConfidence {
  return value === "high" || value === "medium" || value === "low";
}
