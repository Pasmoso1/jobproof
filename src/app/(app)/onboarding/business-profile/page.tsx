import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/app/(app)/actions";
import { BETA_PLAN_ONBOARDING_PATH, needsPlanSelection } from "@/lib/beta-tester";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import {
  hasJobProofTrialStarted,
  hasLinkedPaidSubscription,
  isOnboardingCompleteForTrial,
  needsTrialActivation,
} from "@/lib/trial-lifecycle";
import { resolveSafeLoginRedirect } from "@/lib/auth/safe-redirect";
import { OnboardingBusinessForm } from "./onboarding-business-form";
import {
  OnboardingStartTracker,
  SignupVerifiedTracker,
} from "@/components/contractor-onboarding-analytics";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";

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
  const returnPath = resolveSafeLoginRedirect(params.redirect ?? null, "/dashboard");

  if (needsPlanSelection(profile)) {
    redirect(BETA_PLAN_ONBOARDING_PATH);
  }

  const awaitingTrial = needsTrialActivation(profile);
  if (profile && isOnboardingCompleteForTrial(profile) && !awaitingTrial) {
    redirect(returnPath.startsWith("/onboarding") ? "/dashboard" : returnPath);
  }

  return (
    <div className="mx-auto max-w-xl">
      <SignupVerifiedTracker confirmed={confirmed} />
      <OnboardingStartTracker step="business_profile" />
      {awaitingTrial ? (
        <Link
          href={BETA_PLAN_ONBOARDING_PATH}
          className="mb-3 inline-flex min-h-11 items-center text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Change plan
        </Link>
      ) : null}
      <OnboardingProgress step={2} />
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-zinc-900">Tell us about your business</h1>
        <p className="mt-1.5 text-sm text-zinc-600">
          Just two details to get started. You can complete your profile later.
        </p>
      </div>

      <OnboardingBusinessForm
        profile={profile}
        confirmed={confirmed}
        redirectTo={params.redirect ?? ""}
        startsTrial={
          profile?.beta_tester !== true &&
          !hasJobProofTrialStarted(profile) &&
          !hasLinkedPaidSubscription(profile)
        }
        maxTotalTrades={getPlanEntitlements(profile).maxTotalTrades}
      />
    </div>
  );
}
