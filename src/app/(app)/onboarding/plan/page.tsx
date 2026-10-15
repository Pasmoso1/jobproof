import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseBillingPricingVersion } from "@/lib/billing-plan-display";
import type { BillingPricingVersion } from "@/lib/stripe";
import {
  isBetaTesterProfile,
  needsPlanSelection,
} from "@/lib/beta-tester";
import { needsTrialActivation, resolveTrialPlanTier } from "@/lib/trial-lifecycle";
import { PlanSelectionForm } from "./plan-selection-form";
import { OnboardingStartTracker } from "@/components/contractor-onboarding-analytics";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";

export const dynamic = "force-dynamic";

export default async function PlanOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding/plan");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "beta_tester, stripe_subscription_id, subscription_status, pricing_version, plan_tier, trial_plan_tier, trial_started_at"
    )
    .eq("user_id", user.id)
    .single();

  // The plan can be changed until the trial starts (e.g. after tapping Back from business setup).
  const canChangePlan = needsTrialActivation(profile);
  if (
    profile &&
    (isBetaTesterProfile(profile) || (!needsPlanSelection(profile) && !canChangePlan))
  ) {
    redirect("/onboarding/business-profile");
  }

  const pricingVersion: BillingPricingVersion =
    parseBillingPricingVersion(String(profile?.pricing_version ?? "")) ?? "standard";
  const selectedTier = canChangePlan ? resolveTrialPlanTier(profile) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <OnboardingStartTracker step="plan" />
      <OnboardingProgress step={1} />
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Choose your plan</h1>
        <p className="mt-1.5 text-sm text-zinc-600 sm:text-base">
          Try JobProof free for 14 days. No credit card required.
        </p>
      </div>

      <PlanSelectionForm pricingVersion={pricingVersion} selectedTier={selectedTier} />
    </div>
  );
}
