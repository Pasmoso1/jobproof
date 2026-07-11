import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseBillingPricingVersion } from "@/lib/billing-plan-display";
import type { BillingPricingVersion } from "@/lib/stripe";
import {
  isBetaTesterProfile,
  needsPlanSelection,
} from "@/lib/beta-tester";
import { JobProofLogo } from "@/components/jobproof-logo";
import { PlanSelectionForm } from "./plan-selection-form";

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

  if (profile && (isBetaTesterProfile(profile) || !needsPlanSelection(profile))) {
    redirect("/onboarding/business-profile");
  }

  const pricingVersion: BillingPricingVersion =
    parseBillingPricingVersion(String(profile?.pricing_version ?? "")) ?? "standard";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 text-center">
        <JobProofLogo className="mx-auto mb-6 h-10 w-auto" />
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Choose your plan</h1>
        <p className="mt-2 text-sm text-zinc-600 sm:text-base">
          Pick Solo or Pro for your free trial. No credit card needed.
        </p>
      </div>

      <PlanSelectionForm pricingVersion={pricingVersion} />
    </div>
  );
}
