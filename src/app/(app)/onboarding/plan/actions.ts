"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseBillingPlanTier } from "@/lib/billing-plan-display";
import type { BillingPlanTier } from "@/lib/stripe";
import { isBetaTesterProfile, needsPlanSelection } from "@/lib/beta-tester";
import { saveSelectedTrialPlan } from "@/lib/start-managed-trial";
import { isOnboardingCompleteForTrial } from "@/lib/trial-lifecycle";

export type SelectOnboardingPlanResult =
  | { success: true; redirectTo: string }
  | { success: false; error: string };

export async function selectOnboardingPlan(
  planTier: BillingPlanTier
): Promise<SelectOnboardingPlanResult> {
  const tier = parseBillingPlanTier(planTier);
  if (!tier) {
    return { success: false, error: "Please choose Solo or Pro." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding/plan");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, beta_tester, stripe_subscription_id, subscription_status, plan_tier, trial_plan_tier, trial_started_at, trial_ends_at, trial_email_welcome_sent_at, trial_email_started_sent_at, business_name, phone, address_line_1, city, province, postal_code, quote_primary_trade"
    )
    .eq("user_id", user.id)
    .single();

  if (!profile?.id) {
    return { success: false, error: "Profile not found." };
  }

  if (isBetaTesterProfile(profile)) {
    redirect("/dashboard");
  }

  if (!needsPlanSelection(profile) && profile.trial_started_at) {
    redirect("/dashboard");
  }

  const result = await saveSelectedTrialPlan(
    supabase,
    profile,
    tier,
    user.email ?? ""
  );
  if (!result.ok) {
    return { success: false, error: result.error };
  }

  const { data: refreshed } = await supabase
    .from("profiles")
    .select(
      "business_name, phone, address_line_1, city, province, postal_code, quote_primary_trade, trial_started_at, plan_tier, trial_plan_tier"
    )
    .eq("id", profile.id)
    .single();

  if (
    refreshed &&
    isOnboardingCompleteForTrial(refreshed, user.email ?? "") &&
    refreshed.trial_started_at
  ) {
    return { success: true, redirectTo: "/dashboard" };
  }

  return { success: true, redirectTo: "/onboarding/business-profile" };
}
