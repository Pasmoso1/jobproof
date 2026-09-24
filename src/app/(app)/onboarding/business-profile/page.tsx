import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/app/(app)/actions";
import { BETA_PLAN_ONBOARDING_PATH, needsPlanSelection } from "@/lib/beta-tester";
import { JobProofLogo } from "@/components/jobproof-logo";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import { isOnboardingCompleteForTrial } from "@/lib/trial-lifecycle";
import { OnboardingBusinessForm } from "./onboarding-business-form";
import {
  OnboardingStartTracker,
  SignupVerifiedTracker,
} from "@/components/contractor-onboarding-analytics";

export const dynamic = "force-dynamic";

export default async function OnboardingBusinessProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string; redirect?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  const params = await searchParams;
  const confirmed = params.confirmed === "true";

  if (needsPlanSelection(profile)) {
    redirect(BETA_PLAN_ONBOARDING_PATH);
  }

  if (profile && isOnboardingCompleteForTrial(profile, user.email ?? "")) {
    redirect(params.redirect ?? "/dashboard");
  }

  return (
    <div className="mx-auto max-w-xl">
      <SignupVerifiedTracker confirmed={confirmed} />
      <OnboardingStartTracker step="business_profile" />
      <div className="mb-8 text-center">
        <JobProofLogo className="mx-auto mb-6 h-10 w-auto" />
        <h1 className="text-2xl font-bold text-zinc-900">Set up your business profile</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Finish setup to start your 14-day free trial. No credit card required.
        </p>
      </div>

      <OnboardingBusinessForm
        profile={profile}
        userEmail={user.email ?? ""}
        confirmed={confirmed}
        maxTotalTrades={getPlanEntitlements(profile).maxTotalTrades}
      />
    </div>
  );
}
