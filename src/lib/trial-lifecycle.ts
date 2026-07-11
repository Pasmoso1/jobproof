import type { BillingPlanTier } from "@/lib/stripe";
import { parseBillingPlanTier } from "@/lib/billing-plan-display";
import {
  getPlanEntitlements,
  profileLimitColumnsForTier,
  resolveEffectivePlanTier,
  type PlanEntitlementProfile,
} from "@/lib/plan-entitlements";
import { isBusinessProfileCompleteForApp } from "@/lib/validation/business-profile";

/** Calendar length of the JobProof-managed free trial. */
export const JOBPROOF_TRIAL_DAYS = 14;

export type TrialLifecycleProfile = PlanEntitlementProfile & {
  id?: string;
  subscription_status?: string | null;
  stripe_subscription_id?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  trial_plan_tier?: string | null;
  quote_primary_trade?: string | null;
  business_name?: string | null;
  phone?: string | null;
  address_line_1?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
};

export function resolveTrialPlanTier(
  profile: TrialLifecycleProfile | null | undefined
): BillingPlanTier | null {
  if (!profile) return null;
  return (
    parseBillingPlanTier(String(profile.trial_plan_tier ?? "")) ??
    parseBillingPlanTier(String(profile.plan_tier ?? ""))
  );
}

export function hasSelectedTrialPlan(
  profile: TrialLifecycleProfile | null | undefined
): boolean {
  return resolveTrialPlanTier(profile) != null;
}

/** Business profile + primary trade required before the trial clock starts. */
export function isOnboardingCompleteForTrial(
  profile: TrialLifecycleProfile | null | undefined,
  accountEmail: string
): boolean {
  if (!profile) return false;
  if (
    !isBusinessProfileCompleteForApp({
      business_name: profile.business_name,
      account_email: accountEmail,
      phone: profile.phone,
      address_line_1: profile.address_line_1,
      city: profile.city,
      province: profile.province,
      postal_code: profile.postal_code,
    })
  ) {
    return false;
  }
  return Boolean(String(profile.quote_primary_trade ?? "").trim());
}

export function hasJobProofTrialStarted(
  profile: TrialLifecycleProfile | null | undefined
): boolean {
  return Boolean(String(profile?.trial_started_at ?? "").trim());
}

export function computeTrialEndsAt(startedAt: Date = new Date()): Date {
  const end = new Date(startedAt.getTime());
  end.setUTCDate(end.getUTCDate() + JOBPROOF_TRIAL_DAYS);
  return end;
}

/** Whole calendar days remaining (ceil). 0 on last day after start; null if not started. */
export function getTrialDaysRemaining(
  profile: TrialLifecycleProfile | null | undefined,
  now: Date = new Date()
): number | null {
  const endRaw = String(profile?.trial_ends_at ?? "").trim();
  if (!endRaw) return null;
  const end = new Date(endRaw).getTime();
  if (!Number.isFinite(end)) return null;
  const ms = end - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function formatTrialDaysRemainingLabel(daysRemaining: number | null): string | null {
  if (daysRemaining == null) return null;
  if (daysRemaining <= 0) return "Your free trial has ended";
  if (daysRemaining === 1) return "Last day of your trial";
  return `${daysRemaining} days remaining`;
}

export function isJobProofManagedTrialActive(
  profile: TrialLifecycleProfile | null | undefined,
  now: Date = new Date()
): boolean {
  if (!hasJobProofTrialStarted(profile)) return false;
  const status = String(profile?.subscription_status ?? "").trim().toLowerCase();
  if (status !== "trial" && status !== "pending_trial") return false;
  const subId = String(profile?.stripe_subscription_id ?? "").trim();
  if (subId) return false;
  const endRaw = String(profile?.trial_ends_at ?? "").trim();
  if (!endRaw) return false;
  const end = new Date(endRaw).getTime();
  return Number.isFinite(end) && end > now.getTime();
}

export function isJobProofTrialExpired(
  profile: TrialLifecycleProfile | null | undefined,
  now: Date = new Date()
): boolean {
  if (profile?.beta_tester === true) return false;
  const subId = String(profile?.stripe_subscription_id ?? "").trim();
  if (subId) {
    const st = String(profile?.subscription_status ?? "").trim().toLowerCase();
    if (["active", "trialing", "past_due"].includes(st)) return false;
  }
  const status = String(profile?.subscription_status ?? "").trim().toLowerCase();
  if (status === "expired") return true;
  if (!hasJobProofTrialStarted(profile)) return false;
  const endRaw = String(profile?.trial_ends_at ?? "").trim();
  if (!endRaw) return false;
  const end = new Date(endRaw).getTime();
  return Number.isFinite(end) && end <= now.getTime() && !subId;
}

/** Profile columns to write when starting the managed trial. */
export function buildTrialStartProfilePatch(planTier: BillingPlanTier, startedAt: Date = new Date()) {
  const endsAt = computeTrialEndsAt(startedAt);
  return {
    plan_tier: planTier,
    trial_plan_tier: planTier,
    subscription_status: "trial" as const,
    trial_started_at: startedAt.toISOString(),
    trial_ends_at: endsAt.toISOString(),
    pricing_version: "standard" as const,
    ...profileLimitColumnsForTier(planTier),
  };
}

/** Profile columns when selecting a plan before onboarding is complete. */
export function buildPendingTrialPlanPatch(planTier: BillingPlanTier) {
  return {
    plan_tier: planTier,
    trial_plan_tier: planTier,
    subscription_status: "pending_trial" as const,
    pricing_version: "standard" as const,
    trial_started_at: null,
    trial_ends_at: null,
    ...profileLimitColumnsForTier(planTier),
  };
}

export function trialEntitlementsForProfile(profile: TrialLifecycleProfile | null | undefined) {
  const tier = resolveTrialPlanTier(profile) ?? resolveEffectivePlanTier(profile);
  return getPlanEntitlements(tier);
}
