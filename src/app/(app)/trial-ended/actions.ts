"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { needsTrialExpiredIntro } from "@/lib/trial-lifecycle";

async function markTrialExpiredIntroSeen(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, subscription_status, trial_started_at, trial_ends_at, trial_expired_screen_seen_at, stripe_subscription_id, beta_tester"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login");

  // Already dismissed — nothing to do.
  if (!needsTrialExpiredIntro(profile) && String(profile.trial_expired_screen_seen_at ?? "").trim()) {
    return;
  }

  const patch: Record<string, string> = {
    trial_expired_screen_seen_at: new Date().toISOString(),
  };
  if (!String(profile.stripe_subscription_id ?? "").trim()) {
    patch.subscription_status = "expired";
  }

  await supabase.from("profiles").update(patch).eq("id", profile.id);
}

/** Dismiss intro and open Billing to subscribe. */
export async function continueToBillingAfterTrialExpired(): Promise<void> {
  await markTrialExpiredIntroSeen();
  redirect("/settings/billing");
}

/** Dismiss intro and enter the app in read-only mode. */
export async function continueInReadOnlyAfterTrialExpired(): Promise<void> {
  await markTrialExpiredIntroSeen();
  redirect("/dashboard");
}
