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
  beta_tester?: boolean | null;
  beta_plan_tier?: string | null;
  plan_tier?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
}): BillingUiTier {
  if (p.beta_tester === true) {
    const tier = parseBillingPlanTier(String(p.beta_plan_tier ?? p.plan_tier ?? ""));
    return tier ?? "none";
  }
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
  essential: "$29 CAD/month",
  professional: "$49 CAD/month",
};

const STANDARD: Record<BillingPlanTier, string> = {
  essential: "$39 CAD/month",
  professional: "$59 CAD/month",
};

const APPLICABLE_TAXES_SUFFIX = " + applicable taxes";

/** Short display used in buttons: "$39 CAD/mo + tax" style. */
export function getPlanPriceWithTaxesLine(
  planTier: BillingPlanTier,
  pricingVersion: BillingPricingVersion
): string {
  const base = (pricingVersion === "founder" ? FOUNDER : STANDARD)[planTier];
  // Keep "/mo" compact for buttons while still indicating taxes.
  const compact = base.replace("/month", "/mo");
  return `${compact}${APPLICABLE_TAXES_SUFFIX}`;
}

/** Public/marketing: "$39 CAD/month + applicable taxes" */
export function getPublicPlanPriceLine(
  planTier: BillingPlanTier,
  pricingVersion: BillingPricingVersion = "standard"
): string {
  const base = (pricingVersion === "founder" ? FOUNDER : STANDARD)[planTier];
  return `${base}${APPLICABLE_TAXES_SUFFIX}`;
}

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
  pricingVersion: BillingPricingVersion,
  options?: { betaTester?: boolean }
): PlanDisplay {
  const tier = TIER_NAME[planTier];
  const recurring = (pricingVersion === "founder" ? FOUNDER : STANDARD)[planTier];
  const withTax = `${recurring}${APPLICABLE_TAXES_SUFFIX}`;
  const planLine = options?.betaTester
    ? `${tier} (Beta Tester)`
    : pricingVersion === "founder"
      ? `${tier} Founder — ${withTax}`
      : `${tier} — ${withTax}`;
  return { planLine, afterTrialLine: withTax };
}

export function getPlanDisplayLinesForProfile(p: {
  beta_tester?: boolean | null;
  beta_plan_tier?: string | null;
  plan_tier?: string | null;
  pricing_version?: string | null;
}): PlanDisplay | null {
  const tier =
    parseBillingPlanTier(String(p.beta_plan_tier ?? "")) ??
    parseBillingPlanTier(String(p.plan_tier ?? ""));
  if (!tier) return null;
  const pricing = parseBillingPricingVersion(String(p.pricing_version ?? "")) ?? "standard";
  return getPlanDisplayLines(tier, pricing, { betaTester: p.beta_tester === true });
}

export function betaTesterBillingBannerMessage(p: {
  beta_plan_tier?: string | null;
  plan_tier?: string | null;
}): string {
  const tier = parseBillingPlanTier(String(p.beta_plan_tier ?? p.plan_tier ?? ""));
  const label = tier === "professional" ? "Professional" : tier === "essential" ? "Essential" : "selected";
  return `Thank you for helping test JobProof. You currently have free beta access to the ${label} plan.`;
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
