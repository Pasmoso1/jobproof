import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";
import { parseBillingPlanTier } from "@/lib/billing-plan-display";
import type { BillingPlanTier } from "@/lib/stripe";

type ConversionProfile = {
  id: string;
  subscription_status?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  trial_plan_tier?: string | null;
  plan_tier?: string | null;
  stripe_subscription_id?: string | null;
};

/**
 * Fires subscription_started + trial_converted when moving from a JobProof-managed
 * trial (or expired trial) into a paid Stripe subscription.
 */
export function trackTrialConversionAnalytics(input: {
  profile: ConversionProfile;
  previousStatus: string;
  newStatus: string;
  subscribedPlan: BillingPlanTier | string | null | undefined;
  source: string;
}): void {
  const prev = input.previousStatus.trim().toLowerCase();
  const next = input.newStatus.trim().toLowerCase();
  if (!["active", "trialing"].includes(next)) return;
  // Already paid — avoid duplicate events from checkout + subscription.created race.
  if (["active", "trialing", "past_due"].includes(prev)) return;

  const cameFromManagedTrial = ["pending_trial", "trial", "expired"].includes(prev);
  if (!cameFromManagedTrial) {
    trackProductEventSafe({
      profileId: input.profile.id,
      eventName: PRODUCT_ANALYTICS_EVENTS.subscription_started,
      source: input.source,
      metadata: {
        selected_plan: input.subscribedPlan ?? null,
        from_status: prev,
      },
    });
    return;
  }

  const trialPlan =
    parseBillingPlanTier(String(input.profile.trial_plan_tier ?? "")) ??
    parseBillingPlanTier(String(input.profile.plan_tier ?? ""));
  const subscribed =
    parseBillingPlanTier(String(input.subscribedPlan ?? "")) ?? trialPlan;

  let hoursToSubscribe: number | null = null;
  const started = String(input.profile.trial_started_at ?? "").trim();
  if (started) {
    const ms = Date.now() - new Date(started).getTime();
    if (Number.isFinite(ms) && ms >= 0) {
      hoursToSubscribe = Math.round((ms / (60 * 60 * 1000)) * 10) / 10;
    }
  }

  trackProductEventSafe({
    profileId: input.profile.id,
    eventName: PRODUCT_ANALYTICS_EVENTS.subscription_started,
    source: input.source,
    metadata: {
      selected_plan: subscribed,
      trial_plan: trialPlan,
      from_status: prev,
      hours_from_trial_start: hoursToSubscribe,
    },
  });

  trackProductEventSafe({
    profileId: input.profile.id,
    eventName: PRODUCT_ANALYTICS_EVENTS.trial_converted,
    source: input.source,
    metadata: {
      selected_plan: subscribed,
      trial_plan: trialPlan,
      conversion_by_selected_plan: subscribed,
      hours_from_onboarding_completion: hoursToSubscribe,
      trial_started_at: input.profile.trial_started_at ?? null,
      trial_ends_at: input.profile.trial_ends_at ?? null,
    },
  });
}

/** Prefer preserving JobProof trial end when Stripe has no trial_end. */
export function resolveTrialEndsAtForStripeSync(
  stripeTrialEndUnix: number | null | undefined,
  existingTrialEndsAt: string | null | undefined
): string | null {
  if (typeof stripeTrialEndUnix === "number" && stripeTrialEndUnix > 0) {
    return new Date(stripeTrialEndUnix * 1000).toISOString();
  }
  const existing = String(existingTrialEndsAt ?? "").trim();
  return existing || null;
}
