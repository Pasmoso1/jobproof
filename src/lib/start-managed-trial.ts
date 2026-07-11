import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingPlanTier } from "@/lib/stripe";
import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";
import {
  buildPendingTrialPlanPatch,
  buildTrialStartProfilePatch,
  hasJobProofTrialStarted,
  isOnboardingCompleteForTrial,
  resolveTrialPlanTier,
  type TrialLifecycleProfile,
} from "@/lib/trial-lifecycle";
import { sendTrialStartedEmail, sendTrialWelcomeEmail } from "@/lib/trial-emails";

type ProfileRow = TrialLifecycleProfile & {
  id: string;
  trial_email_welcome_sent_at?: string | null;
  trial_email_started_sent_at?: string | null;
};

export async function saveSelectedTrialPlan(
  supabase: SupabaseClient,
  profile: ProfileRow,
  planTier: BillingPlanTier,
  accountEmail: string
): Promise<{ ok: true; trialStarted: boolean } | { ok: false; error: string }> {
  if (hasJobProofTrialStarted(profile)) {
    return {
      ok: false,
      error: "Your trial plan is locked while your free trial is active.",
    };
  }

  const patch = buildPendingTrialPlanPatch(planTier);
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", profile.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  trackProductEventSafe({
    profileId: profile.id,
    eventName: PRODUCT_ANALYTICS_EVENTS.plan_selected,
    source: "onboarding_plan",
    metadata: { selected_plan: planTier },
  });

  if (!profile.trial_email_welcome_sent_at) {
    await sendTrialWelcomeEmail({
      profileId: profile.id,
      userEmail: accountEmail,
      planTier,
    });
    await supabase
      .from("profiles")
      .update({ trial_email_welcome_sent_at: new Date().toISOString() })
      .eq("id", profile.id);
  }

  const refreshed: ProfileRow = {
    ...profile,
    ...patch,
  };

  const started = await maybeStartManagedTrial(supabase, refreshed, accountEmail);
  return { ok: true, trialStarted: started };
}

/**
 * Starts the 14-day trial when plan is selected and onboarding is complete.
 * Idempotent if the trial already started.
 */
export async function maybeStartManagedTrial(
  supabase: SupabaseClient,
  profile: ProfileRow,
  accountEmail: string
): Promise<boolean> {
  if (profile.beta_tester === true) return false;
  if (hasJobProofTrialStarted(profile)) return false;
  if (String(profile.stripe_subscription_id ?? "").trim()) return false;

  const planTier = resolveTrialPlanTier(profile);
  if (!planTier) return false;
  if (!isOnboardingCompleteForTrial(profile, accountEmail)) return false;

  const patch = buildTrialStartProfilePatch(planTier);
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", profile.id)
    .is("trial_started_at", null);

  if (error) {
    console.error("[maybeStartManagedTrial]", error.message);
    return false;
  }

  trackProductEventSafe({
    profileId: profile.id,
    eventName: PRODUCT_ANALYTICS_EVENTS.trial_started,
    source: "onboarding_complete",
    metadata: {
      selected_plan: planTier,
      trial_started_at: patch.trial_started_at,
      trial_ends_at: patch.trial_ends_at,
    },
  });

  if (!profile.trial_email_started_sent_at) {
    await sendTrialStartedEmail({
      profileId: profile.id,
      userEmail: accountEmail,
      planTier,
      trialEndsAt: patch.trial_ends_at,
    });
    await supabase
      .from("profiles")
      .update({ trial_email_started_sent_at: new Date().toISOString() })
      .eq("id", profile.id);
  }

  return true;
}
