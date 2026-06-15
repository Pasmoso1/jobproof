"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseBillingPlanTier } from "@/lib/billing-plan-display";
import type { BillingPlanTier } from "@/lib/stripe";
import { isBetaTesterProfile, needsBetaPlanSelection } from "@/lib/beta-tester";
import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";
import {
  createSubscriptionCheckoutSession,
  type SubscriptionCheckoutSessionResult,
} from "@/app/(app)/settings/billing/actions";

export async function startOnboardingPlanCheckout(
  planTier: BillingPlanTier
): Promise<SubscriptionCheckoutSessionResult> {
  const tier = parseBillingPlanTier(planTier);
  if (!tier) {
    return { success: false, error: "Please choose Essential or Professional." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding/plan");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, beta_tester, stripe_subscription_id, subscription_status")
    .eq("user_id", user.id)
    .single();

  if (!profile?.id) {
    return { success: false, error: "Profile not found." };
  }

  if (isBetaTesterProfile(profile)) {
    redirect("/dashboard");
  }

  if (!needsBetaPlanSelection(profile)) {
    redirect("/dashboard");
  }

  trackProductEventSafe({
    profileId: String(profile.id),
    eventName: PRODUCT_ANALYTICS_EVENTS.plan_selected,
    source: "onboarding_plan",
    metadata: { selected_plan: tier },
  });

  return createSubscriptionCheckoutSession({ planTier: tier, returnTo: "onboarding" });
}
