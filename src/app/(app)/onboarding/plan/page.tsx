import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBusinessProfileCompleteForApp } from "@/lib/validation/business-profile";
import {
  BETA_PLAN_ONBOARDING_PATH,
  isBetaTesterProfile,
  needsBetaPlanSelection,
} from "@/lib/beta-tester";
import { BetaPlanSelectionForm } from "./beta-plan-selection-form";

export const dynamic = "force-dynamic";

export default async function BetaPlanOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding/plan");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "business_name, phone, address_line_1, city, province, postal_code, beta_tester, beta_plan_tier, stripe_subscription_id, plan_tier"
    )
    .eq("user_id", user.id)
    .single();

  if (
    profile &&
    !isBusinessProfileCompleteForApp({
      business_name: profile.business_name,
      account_email: user.email ?? "",
      phone: profile.phone,
      address_line_1: profile.address_line_1,
      city: profile.city,
      province: profile.province,
      postal_code: profile.postal_code,
    })
  ) {
    redirect(`/onboarding/business-profile?redirect=${encodeURIComponent(BETA_PLAN_ONBOARDING_PATH)}`);
  }

  if (profile && (isBetaTesterProfile(profile) || !needsBetaPlanSelection(profile))) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 text-center">
        <img src="/jobproof-logo.png" alt="JobProof" className="mx-auto mb-6 h-10 w-auto" />
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Choose your plan</h1>
        <p className="mt-2 text-sm text-zinc-600 sm:text-base">
          Pick the plan that fits your business. No payment required during the beta.
        </p>
      </div>
      <BetaPlanSelectionForm />
    </div>
  );
}
