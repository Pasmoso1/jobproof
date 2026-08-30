/** JobProof Partner Program — constants and display helpers (CAD one-time rewards). */

export const FOUNDING_PARTNER_LIMIT = 10;
export const FOUNDING_REWARD_CAD = 150;
export const STANDARD_REWARD_CAD = 100;
/** Days of continuous paying subscription required before reward qualifies. */
export const PARTNER_QUALIFICATION_DAYS = 90;
export const PARTNER_AGREEMENT_VERSION = "2026-07-01";
export const PARTNER_AGREEMENT_PATH = "/partners/agreement";

export const PARTNER_TYPE_CREATOR = "creator" as const;
export const PARTNER_TYPE_MARKETING = "marketing" as const;
export const PARTNER_TYPE_ORGANIZATION = "organization" as const;

/** @deprecated Use PARTNER_TYPE_ORGANIZATION. */
export const ORGANIZATION_PARTNER_TYPE = PARTNER_TYPE_ORGANIZATION;

export const PARTNER_TYPES = [
  {
    value: PARTNER_TYPE_CREATOR,
    label: "Creator",
    shortLabel: "Creator Partner",
    description:
      "Share JobProof with your audience and earn rewards when contractors you refer become qualified JobProof customers.",
    applyHint: "For creators, contractors, podcasters and others with an audience.",
    applyHref: "/partners/apply?type=creator",
    ctaLabel: "Become a Creator Partner",
    cardBody:
      "Introduce JobProof so contractors can win more work and run stronger businesses.",
    dashboardIntro: "Share JobProof with your audience.",
  },
  {
    value: PARTNER_TYPE_MARKETING,
    label: "Marketing",
    shortLabel: "Marketing Partner",
    description:
      "Promote JobProof through your audience, content or marketing channels and earn rewards for qualified contractor customers.",
    applyHint:
      "For affiliate marketers, publishers, newsletters, media businesses and performance marketers.",
    applyHref: "/partners/apply?type=marketing",
    ctaLabel: "Become a Marketing Partner",
    cardBody:
      "Promote JobProof through affiliate marketing, publications, newsletters, websites or performance marketing.",
    dashboardIntro:
      "Promote JobProof and earn rewards for qualified contractor customers.",
  },
  {
    value: PARTNER_TYPE_ORGANIZATION,
    label: "Organization",
    shortLabel: "Organization Partner",
    description:
      "Introduce JobProof to your members and earn partner rewards while helping contractors access tools to win more work and grow their businesses.",
    applyHint:
      "For associations, trade organizations, contractor groups and membership organizations.",
    applyHref: "/partners/organizations/apply",
    ctaLabel: "Become an Organization Partner",
    cardBody: "Introduce JobProof to your members and contractor community.",
    dashboardIntro: "Introduce JobProof to your members.",
  },
] as const;

export type PartnerTypeValue = (typeof PARTNER_TYPES)[number]["value"];

/** Alias of the three public partner types. */
export type PartnerCategory = PartnerTypeValue;

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
  | "needs_review"
  | "approved"
  | "paid"
  | "cancelled"
  | "forfeited";

const CANONICAL_TYPES = new Set<string>([
  PARTNER_TYPE_CREATOR,
  PARTNER_TYPE_MARKETING,
  PARTNER_TYPE_ORGANIZATION,
]);

/**
 * Map stored / legacy partner_type values onto the three program types.
 * Organization stays organization. Marketing stays marketing.
 * Influencer and all other historical individual types default to creator.
 */
export function normalizePartnerType(
  partnerType: string | null | undefined
): PartnerTypeValue {
  const value = String(partnerType ?? "").trim().toLowerCase();
  if (value === PARTNER_TYPE_ORGANIZATION || value === "trade_organization") {
    return PARTNER_TYPE_ORGANIZATION;
  }
  if (value === PARTNER_TYPE_MARKETING) {
    return PARTNER_TYPE_MARKETING;
  }
  return PARTNER_TYPE_CREATOR;
}

export function isCanonicalPartnerType(
  value: string | null | undefined
): value is PartnerTypeValue {
  return CANONICAL_TYPES.has(String(value ?? ""));
}

export function isOrganizationPartnerType(
  partnerType: string | null | undefined
): boolean {
  return normalizePartnerType(partnerType) === PARTNER_TYPE_ORGANIZATION;
}

export function isCreatorPartnerType(
  partnerType: string | null | undefined
): boolean {
  return normalizePartnerType(partnerType) === PARTNER_TYPE_CREATOR;
}

export function isMarketingPartnerType(
  partnerType: string | null | undefined
): boolean {
  return normalizePartnerType(partnerType) === PARTNER_TYPE_MARKETING;
}

export function partnerCategory(
  partnerType: string | null | undefined
): PartnerCategory {
  return normalizePartnerType(partnerType);
}

export function partnerCategoryLabel(
  partnerType: string | null | undefined
): string {
  return partnerTypeLabel(normalizePartnerType(partnerType));
}

export function partnerTypeLabel(value: string): string {
  const canonical = isCanonicalPartnerType(value)
    ? value
    : normalizePartnerType(value);
  return PARTNER_TYPES.find((t) => t.value === canonical)?.label ?? value;
}

export function partnerTypeMeta(partnerType: string | null | undefined) {
  const value = normalizePartnerType(partnerType);
  return PARTNER_TYPES.find((t) => t.value === value) ?? PARTNER_TYPES[0];
}

export function rewardAmountForLevel(level: PartnerLevel): number {
  return level === "founding" ? FOUNDING_REWARD_CAD : STANDARD_REWARD_CAD;
}

/**
 * Organization Partners always receive $150 CAD regardless of partner_level.
 * Creator and Marketing Partners follow Founding ($150) / Standard ($100) levels.
 */
export function rewardAmountForPartner(input: {
  partner_level: PartnerLevel | string;
  partner_type?: string | null;
}): number {
  if (isOrganizationPartnerType(input.partner_type)) {
    return FOUNDING_REWARD_CAD; // fixed $150 for all org partners
  }
  const level =
    input.partner_level === "founding" ? "founding" : "standard";
  return rewardAmountForLevel(level);
}

export function partnerLevelLabel(level: PartnerLevel): string {
  return level === "founding" ? "Founding Partner" : "Standard Partner";
}

export function partnerRewardSummary(level: PartnerLevel): string {
  return `$${rewardAmountForLevel(level)} CAD per qualified referral`;
}

/** Admin payout workflow labels. */
export function adminRewardStatusLabel(status: PartnerRewardStatus): string {
  switch (status) {
    case "pending":
      return "Pending qualification";
    case "qualified":
      return "Qualified";
    case "needs_review":
      return "Needs review";
    case "approved":
      return "Ready for payment";
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

/** @deprecated Prefer adminRewardStatusLabel for admin UI. */
export function rewardStatusLabel(status: PartnerRewardStatus): string {
  return adminRewardStatusLabel(status);
}

/** Partner Portal labels — hides internal verification/review workflow. */
export function partnerFacingRewardStatusLabel(status: PartnerRewardStatus): string {
  switch (status) {
    case "pending":
      return "Pending qualification";
    case "qualified":
    case "needs_review":
    case "approved":
      return "Qualified";
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

export function filterRecordsByPartnerType<T extends { partner_type?: string | null; partner_type_value?: string | null }>(
  records: T[],
  filter: "all" | PartnerTypeValue
): T[] {
  if (filter === "all") return records;
  return records.filter((row) => {
    const raw = row.partner_type_value ?? row.partner_type ?? "";
    return normalizePartnerType(raw) === filter;
  });
}
