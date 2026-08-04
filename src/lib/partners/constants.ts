/** JobProof Partner Program — constants and display helpers (CAD one-time rewards). */

export const FOUNDING_PARTNER_LIMIT = 10;
export const FOUNDING_REWARD_CAD = 150;
export const STANDARD_REWARD_CAD = 100;
/** Organization Partners earn $150 CAD per qualified referral (independent of founding seats). */
export const ORGANIZATION_REWARD_CAD = 150;
/** Days of continuous paying subscription required before reward qualifies. */
export const PARTNER_QUALIFICATION_DAYS = 90;
export const PARTNER_AGREEMENT_VERSION = "2026-07-01";
export const PARTNER_AGREEMENT_PATH = "/partners/agreement";

/** Partner type used by the Association & Organization Partners application. */
export const ORGANIZATION_PARTNER_TYPE = "organization" as const;

export const PARTNER_TYPES = [
  { value: "influencer", label: "Influencer" },
  { value: ORGANIZATION_PARTNER_TYPE, label: "Organization" },
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

/** High-level category for admin review and portal UX. */
export type PartnerCategory = "individual" | "influencer" | "organization";

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

export function isOrganizationPartnerType(partnerType: string | null | undefined): boolean {
  return partnerType === ORGANIZATION_PARTNER_TYPE;
}

export function partnerCategory(partnerType: string | null | undefined): PartnerCategory {
  if (isOrganizationPartnerType(partnerType)) return "organization";
  if (partnerType === "influencer") return "influencer";
  return "individual";
}

export function partnerCategoryLabel(partnerType: string | null | undefined): string {
  switch (partnerCategory(partnerType)) {
    case "organization":
      return "Organization";
    case "influencer":
      return "Influencer";
    default:
      return "Individual Partner";
  }
}

export function partnerTypeLabel(value: string): string {
  return PARTNER_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function rewardAmountForLevel(level: PartnerLevel): number {
  return level === "founding" ? FOUNDING_REWARD_CAD : STANDARD_REWARD_CAD;
}

/**
 * Reward amount for a partner record.
 * Organization Partners always receive ORGANIZATION_REWARD_CAD ($150).
 * Founding / Standard amounts are unchanged for all other partner types.
 */
export function rewardAmountForPartner(input: {
  partner_level: PartnerLevel | string;
  partner_type?: string | null;
}): number {
  if (isOrganizationPartnerType(input.partner_type)) {
    return ORGANIZATION_REWARD_CAD;
  }
  const level =
    input.partner_level === "founding" ? "founding" : "standard";
  return rewardAmountForLevel(level);
}

export function partnerLevelLabel(level: PartnerLevel): string {
  return level === "founding" ? "Founding Partner" : "Standard Partner";
}

export function partnerRewardSummary(
  level: PartnerLevel,
  partnerType?: string | null
): string {
  return `$${rewardAmountForPartner({ partner_level: level, partner_type: partnerType })} CAD per qualified referral`;
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
