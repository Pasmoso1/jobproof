import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBusinessProfileCompleteForApp } from "@/lib/validation/business-profile";
import { parseBillingPricingVersion } from "@/lib/billing-plan-display";
import type { BillingPricingVersion } from "@/lib/stripe";
import {
  BETA_PLAN_ONBOARDING_PATH,
  isBetaTesterProfile,
  needsBetaPlanSelection,
} from "@/lib/beta-tester";
import { PlanSelectionForm } from "./plan-selection-form";

export const dynamic = "force-dynamic";

function firstSearchParam(v: string | string[] | undefined): string {
  if (v == null) return "";
  const raw = Array.isArray(v) ? v[0] : v;
  return String(raw ?? "").trim();
}

export default async function PlanOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const checkoutCancelled = firstSearchParam(sp.checkout) === "cancelled";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding/plan");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "business_name, phone, address_line_1, city, province, postal_code, beta_tester, stripe_subscription_id, subscription_status, pricing_version"
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

  const pricingVersion: BillingPricingVersion =
    parseBillingPricingVersion(String(profile?.pricing_version ?? "")) ?? "founder";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 text-center">
        <img src="/jobproof-logo.png" alt="JobProof" className="mx-auto mb-6 h-10 w-auto" />
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Choose your plan</h1>
        <p className="mt-2 text-sm text-zinc-600 sm:text-base">
          Start your free trial, then continue with the plan that fits your business.
        </p>
      </div>

      {checkoutCancelled ? (
        <p className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          Checkout was cancelled. Choose a plan when you&apos;re ready to continue.
        </p>
      ) : null}

      <PlanSelectionForm pricingVersion={pricingVersion} />
    </div>
  );
}
