import type { BillingPlanTier } from "@/lib/stripe";
import { parseBillingPlanTier } from "@/lib/billing-plan-display";

export type BetaTesterProfileFields = {
  beta_tester?: boolean | null;
  beta_plan_tier?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  plan_tier?: string | null;
};

export function isBetaTesterProfile(profile: BetaTesterProfileFields | null | undefined): boolean {
  return profile?.beta_tester === true;
}

/** Blocks Stripe subscription billing actions for beta testers (free access, no checkout). */
export function betaTesterStripeBillingBlocked(profile: {
  beta_tester?: boolean | null;
}): { blocked: true; error: string } | { blocked: false } {
  if (isBetaTesterProfile(profile)) {
    return {
      blocked: true,
      error:
        "Beta testers have free access during testing. Subscription checkout and billing changes are not required.",
    };
  }
  return { blocked: false };
}

export function hasPaidStripeSubscription(profile: BetaTesterProfileFields | null | undefined): boolean {
  return Boolean(String(profile?.stripe_subscription_id ?? "").trim());
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "trialing",
  "active",
  "past_due",
  "incomplete",
  "unpaid",
]);

/** True when the profile has a Stripe subscription in an active-like state. */
export function hasActiveJobProofSubscription(
  profile: BetaTesterProfileFields & { subscription_status?: string | null } | null | undefined
): boolean {
  if (!profile) return false;
  const subId = String(profile.stripe_subscription_id ?? "").trim();
  if (!subId) return false;
  const st = String(profile.subscription_status ?? "").trim().toLowerCase();
  return ACTIVE_SUBSCRIPTION_STATUSES.has(st);
}

/**
 * True when user must complete Stripe subscription checkout before using the app.
 * Legacy beta testers (beta_tester=true) skip; new signups require Stripe.
 */
export function needsBetaPlanSelection(profile: BetaTesterProfileFields | null | undefined): boolean {
  if (!profile) return false;
  if (isBetaTesterProfile(profile)) return false;
  if (hasActiveJobProofSubscription(profile)) return false;
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
