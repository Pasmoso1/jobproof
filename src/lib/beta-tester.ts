import type { BillingPlanTier } from "@/lib/stripe";
import { parseBillingPlanTier } from "@/lib/billing-plan-display";

export type BetaTesterProfileFields = {
  beta_tester?: boolean | null;
  beta_plan_tier?: string | null;
  stripe_subscription_id?: string | null;
  plan_tier?: string | null;
};

export function isBetaTesterProfile(profile: BetaTesterProfileFields | null | undefined): boolean {
  return profile?.beta_tester === true;
}

export function hasPaidStripeSubscription(profile: BetaTesterProfileFields | null | undefined): boolean {
  return Boolean(String(profile?.stripe_subscription_id ?? "").trim());
}

/** New contractors without Stripe must pick a beta plan before using the app. */
export function needsBetaPlanSelection(profile: BetaTesterProfileFields | null | undefined): boolean {
  if (!profile) return false;
  if (isBetaTesterProfile(profile)) return false;
  if (hasPaidStripeSubscription(profile)) return false;
  if (parseBillingPlanTier(String(profile.plan_tier ?? ""))) return false;
  return true;
}

export function betaPlanTierLabel(tier: BillingPlanTier | null): string {
  if (tier === "essential") return "Essential";
  if (tier === "professional") return "Professional";
  return "—";
}

export function resolveBetaDisplayPlanTier(
  profile: BetaTesterProfileFields
): BillingPlanTier | null {
  return (
    parseBillingPlanTier(String(profile.beta_plan_tier ?? "")) ??
    parseBillingPlanTier(String(profile.plan_tier ?? ""))
  );
}

export const BETA_PLAN_ONBOARDING_PATH = "/onboarding/plan";
