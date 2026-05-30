"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBillingPlanTier } from "@/lib/billing-plan-display";
import type { BillingPlanTier } from "@/lib/stripe";
import { isBetaTesterProfile, needsBetaPlanSelection } from "@/lib/beta-tester";
import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";

export async function selectBetaPlan(
  planTier: BillingPlanTier
): Promise<{ success: false; error: string } | { success: true }> {
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
    .select("id, beta_tester, stripe_subscription_id, plan_tier")
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

  const profileId = String(profile.id);
  const { error } = await supabase
    .from("profiles")
    .update({
      beta_tester: true,
      beta_plan_tier: tier,
      plan_tier: tier,
      pricing_version: "standard",
      subscription_status: "active",
    })
    .eq("id", profileId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[selectBetaPlan] update failed", error);
    return { success: false, error: "Could not save your plan. Please try again." };
  }

  trackProductEventSafe({
    profileId,
    eventName: PRODUCT_ANALYTICS_EVENTS.beta_tester_created,
    source: "onboarding_plan",
    metadata: { selected_plan: tier },
  });
  trackProductEventSafe({
    profileId,
    eventName: PRODUCT_ANALYTICS_EVENTS.beta_plan_selected,
    source: "onboarding_plan",
    metadata: { selected_plan: tier },
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings/billing");
  revalidatePath("/onboarding/plan");
  redirect("/dashboard");
}
