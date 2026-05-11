import type { BillingPlanTier, BillingPricingVersion } from "@/lib/stripe";

export function parseBillingPlanTier(raw: string): BillingPlanTier | null {
  const t = raw.trim().toLowerCase();
  return t === "essential" || t === "professional" ? t : null;
}

export function parseBillingPricingVersion(raw: string): BillingPricingVersion | null {
  const t = raw.trim().toLowerCase();
  return t === "founder" || t === "standard" ? t : null;
}

export type PlanDisplay = {
  planLine: string;
  afterTrialLine: string;
};

const FOUNDER: Record<BillingPlanTier, string> = {
  essential: "$29/mo",
  professional: "$49/mo",
};

const STANDARD: Record<BillingPlanTier, string> = {
  essential: "$39/mo",
  professional: "$59/mo",
};

const TIER_NAME: Record<BillingPlanTier, string> = {
  essential: "Essential",
  professional: "Professional",
};

export function getPlanDisplayLines(
  planTier: BillingPlanTier,
  pricingVersion: BillingPricingVersion
): PlanDisplay {
  const tier = TIER_NAME[planTier];
  const recurring = (pricingVersion === "founder" ? FOUNDER : STANDARD)[planTier];
  const planLine =
    pricingVersion === "founder"
      ? `${tier} Founder — ${recurring}`
      : `${tier} — ${recurring}`;
  return { planLine, afterTrialLine: recurring };
}

export function formatSubscriptionStatusLabel(raw: string): string {
  const s = raw.trim().toLowerCase();
  switch (s) {
    case "trialing":
    case "trial":
      return "Trial active";
    case "active":
      return "Active";
    case "past_due":
      return "Past due";
    case "canceled":
    case "cancelled":
      return "Canceled";
    case "unpaid":
      return "Unpaid";
    case "incomplete":
      return "Payment incomplete";
    case "incomplete_expired":
      return "Checkout expired";
    default:
      return raw.trim() || "—";
  }
}
