import type { BillingPlanTier, BillingPricingVersion } from "@/lib/stripe";

export function parseBillingPlanTier(raw: string): BillingPlanTier | null {
  const t = raw.trim().toLowerCase();
  return t === "essential" || t === "professional" ? t : null;
}

export function parseBillingPricingVersion(raw: string): BillingPricingVersion | null {
  const t = raw.trim().toLowerCase();
  return t === "founder" || t === "standard" ? t : null;
}

/** Which plan-specific upgrade UI to show (requires an active-like Stripe subscription). */
export type BillingUiTier = "none" | "essential" | "professional";

export function billingUiTierFromProfile(p: {
  plan_tier?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
}): BillingUiTier {
  const tier = parseBillingPlanTier(String(p.plan_tier ?? ""));
  if (!tier) return "none";
  const subId = String(p.stripe_subscription_id ?? "").trim();
  const st = String(p.subscription_status ?? "").trim().toLowerCase();
  const subscribed =
    Boolean(subId) &&
    ["trialing", "active", "past_due", "incomplete", "unpaid"].includes(st);
  if (!subscribed) return "none";
  return tier;
}

export function getUpgradeProfessionalButtonLabel(pricingVersion: BillingPricingVersion): string {
  const { afterTrialLine } = getPlanDisplayLines("professional", pricingVersion);
  return `Upgrade to Professional — ${afterTrialLine}`;
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

/** After upgrading to Professional during trial — no immediate charge implied. */
export function planUpdatedProfessionalTrialingMessage(
  pricingVersion: BillingPricingVersion
): string {
  const { afterTrialLine } = getPlanDisplayLines("professional", pricingVersion);
  return `Plan updated to Professional. Your card will be charged ${afterTrialLine} after your trial ends.`;
}

/** Persistent notice on billing when Professional + trialing. */
export function professionalTrialingBillingBannerMessage(
  pricingVersion: BillingPricingVersion
): string {
  const { afterTrialLine } = getPlanDisplayLines("professional", pricingVersion);
  const label = pricingVersion === "founder" ? "Professional Founder" : "Professional";
  return `You're on ${label}. Your card will be charged ${afterTrialLine} after your trial ends.`;
}

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
