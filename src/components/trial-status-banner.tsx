import Link from "next/link";
import { PENDING_TRIAL_SETUP_MESSAGE } from "@/lib/subscription-access";
import {
  formatTrialDaysRemainingLabel,
  getTrialDaysRemaining,
  hasJobProofTrialStarted,
  hasSelectedTrialPlan,
  isJobProofManagedTrialActive,
  isJobProofTrialExpired,
  isOnboardingCompleteForTrial,
  type TrialLifecycleProfile,
} from "@/lib/trial-lifecycle";

export function TrialStatusBanner({
  profile,
  accountEmail,
}: {
  profile: TrialLifecycleProfile | null | undefined;
  accountEmail: string;
}) {
  if (!profile || profile.beta_tester === true) return null;
  if (String(profile.stripe_subscription_id ?? "").trim()) {
    const st = String(profile.subscription_status ?? "").trim().toLowerCase();
    if (["active", "trialing", "past_due"].includes(st)) return null;
  }

  if (!hasSelectedTrialPlan(profile) || !isOnboardingCompleteForTrial(profile, accountEmail)) {
    return (
      <div className="rounded-lg border border-[#2436BB]/25 bg-[#2436BB]/5 px-4 py-3 text-sm text-zinc-800">
        <p className="font-medium text-zinc-900">{PENDING_TRIAL_SETUP_MESSAGE}</p>
        <p className="mt-1 text-zinc-600">
          Finish your business profile and primary trade so your free trial can begin.
        </p>
        <Link
          href="/onboarding/business-profile"
          className="mt-2 inline-block text-sm font-semibold text-[#2436BB] hover:text-[#1c2a96]"
        >
          Continue setup →
        </Link>
      </div>
    );
  }

  if (isJobProofTrialExpired(profile)) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-medium">
          Your free trial has ended. Subscribe to continue creating new work while keeping all of
          your existing information.
        </p>
        <Link
          href="/settings/billing"
          className="mt-3 inline-flex rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1c2a96]"
        >
          Subscribe Now
        </Link>
      </div>
    );
  }

  if (!hasJobProofTrialStarted(profile)) {
    return (
      <div className="rounded-lg border border-[#2436BB]/25 bg-[#2436BB]/5 px-4 py-3 text-sm text-zinc-800">
        <p className="font-medium text-zinc-900">{PENDING_TRIAL_SETUP_MESSAGE}</p>
      </div>
    );
  }

  if (!isJobProofManagedTrialActive(profile)) return null;

  const days = getTrialDaysRemaining(profile);
  const label = formatTrialDaysRemainingLabel(days);
  if (!label || days == null) return null;

  const urgent = days <= 3;
  return (
    <div
      className={
        urgent
          ? "rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          : "rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700"
      }
    >
      <p className={urgent ? "font-medium" : ""}>
        {label}
        {urgent ? " — subscribe anytime to keep creating new work." : ""}
      </p>
      {urgent ? (
        <Link
          href="/settings/billing"
          className="mt-2 inline-block text-sm font-semibold text-[#2436BB] hover:text-[#1c2a96]"
        >
          Subscribe Now →
        </Link>
      ) : null}
    </div>
  );
}
