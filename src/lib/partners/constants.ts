/** JobProof Partner Program — constants and display helpers (CAD one-time rewards). */

export const FOUNDING_PARTNER_LIMIT = 10;
export const FOUNDING_REWARD_CAD = 150;
export const STANDARD_REWARD_CAD = 100;
/** Days of continuous paying subscription required before reward qualifies. */
export const PARTNER_QUALIFICATION_DAYS = 90;
export const PARTNER_AGREEMENT_VERSION = "2026-07-01";
export const PARTNER_AGREEMENT_PATH = "/partners/agreement";

export const PARTNER_TYPES = [
  { value: "influencer", label: "Influencer" },
  { value: "trade_organization", label: "Trade Organization" },
  { value: "existing_contractor", label: "Existing Contractor" },
  { value: "business_coach", label: "Business Coach" },
  { value: "accounting_firm", label: "Accounting Firm" },
  { value: "financing_company", label: "Financing Company" },
  { value: "insurance_provider", label: "Insurance Provider" },
  { value: "strategic_partner", label: "Strategic Partner" },
  { value: "other", label: "Other" },
] as const;

export type PartnerTypeValue = (typeof PARTNER_TYPES)[number]["value"];

export type PartnerLevel = "founding" | "standard";
export type PartnerStatus = "active" | "suspended" | "declined";
export type PartnerApplicationStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "declined";
export type PartnerRewardStatus =
  | "pending"
  | "qualified"
  | "approved"
  | "paid"
  | "cancelled"
  | "forfeited";

export function partnerTypeLabel(value: string): string {
  return PARTNER_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function rewardAmountForLevel(level: PartnerLevel): number {
  return level === "founding" ? FOUNDING_REWARD_CAD : STANDARD_REWARD_CAD;
}

export function partnerLevelLabel(level: PartnerLevel): string {
  return level === "founding" ? "Founding Partner" : "Standard Partner";
}

export function partnerRewardSummary(level: PartnerLevel): string {
  return `$${rewardAmountForLevel(level)} CAD per qualified referral`;
}

export function rewardStatusLabel(status: PartnerRewardStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "qualified":
      return "Qualified";
    case "approved":
      return "Approved";
    case "paid":
      return "Paid";
    case "cancelled":
      return "Cancelled";
    case "forfeited":
      return "Forfeited";
    default:
      return status;
  }
}

export function buildPartnerReferralUrl(origin: string, referralCode: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/signup?ref=${encodeURIComponent(referralCode)}`;
}
