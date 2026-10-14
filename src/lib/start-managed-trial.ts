import { after } from "next/server";
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

/** Persists the chosen plan only; the trial starts after business setup (`maybeStartManagedTrial`). */
export async function saveSelectedTrialPlan(
  supabase: SupabaseClient,
  profile: ProfileRow,
  planTier: BillingPlanTier,
  accountEmail: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (hasJobProofTrialStarted(profile)) {
    return {
      ok: false,
      error: "Your trial plan is locked while your free trial is active.",
    };
  }

  const patch = buildPendingTrialPlanPatch(planTier);
  const { data: updated, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", profile.id)
    .is("trial_started_at", null)
    .select("id");

  if (error) {
    console.error("[saveSelectedTrialPlan]", error.message);
    return { ok: false, error: "Could not save your plan. Please try again." };
  }
  if (!updated?.length) {
    return {
      ok: false,
      error: "Your trial plan is locked while your free trial is active.",
    };
  }

  trackProductEventSafe({
    profileId: profile.id,
    eventName: PRODUCT_ANALYTICS_EVENTS.plan_selected,
    source: "onboarding_plan",
    metadata: { selected_plan: planTier },
  });

  if (!profile.trial_email_welcome_sent_at) {
    // Sent after the response so the plan step advances without waiting on email delivery.
    after(async () => {
      await sendTrialWelcomeEmail({
        profileId: profile.id,
        userEmail: accountEmail,
        planTier,
      });
      await supabase
        .from("profiles")
        .update({ trial_email_welcome_sent_at: new Date().toISOString() })
        .eq("id", profile.id);
    });
  }

  return { ok: true };
}

/**
 * Starts the 14-day trial when plan is selected and onboarding is complete.
 * Idempotent: only the request whose conditional update wins starts the trial.
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
  if (!isOnboardingCompleteForTrial(profile)) return false;

  const patch = buildTrialStartProfilePatch(planTier);
  const { data: started, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", profile.id)
    .is("trial_started_at", null)
    .select("id");

  if (error) {
    console.error("[maybeStartManagedTrial]", error.message);
    return false;
  }
  if (!started?.length) return false;

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

  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/service-role");
    const { markPartnerReferralTrialStarted } = await import("@/lib/partners/attribution");
    const { syncPartnerReferralBusinessName } = await import(
      "@/lib/partners/apply-attribution"
    );
    const admin = createServiceRoleClient();
    if (admin) {
      await markPartnerReferralTrialStarted(admin, profile.id);
      await syncPartnerReferralBusinessName(
        admin,
        profile.id,
        profile.business_name ?? null
      );
    }
  } catch (err) {
    console.error("[maybeStartManagedTrial] partner referral", err);
  }

  return true;
}
