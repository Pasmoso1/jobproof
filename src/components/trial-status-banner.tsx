import Link from "next/link";
import { LandingIcon } from "@/components/landing/landing-icon";
import { PENDING_TRIAL_SETUP_MESSAGE } from "@/lib/subscription-access";
import {
  getTrialDaysRemaining,
  hasJobProofTrialStarted,
  hasLinkedPaidSubscription,
  hasSelectedTrialPlan,
  isJobProofManagedTrialActive,
  isJobProofTrialExpired,
  isOnboardingCompleteForTrial,
  type TrialLifecycleProfile,
} from "@/lib/trial-lifecycle";

/** At or below this many days left, the banner switches to the amber subscribe prompt. */
export const TRIAL_URGENT_DAYS = 3;
/** Only shown on the managed (card-free) trial; never with a linked Stripe subscription. */
export const ACTIVE_TRIAL_NO_CARD_NOTE = "Explore JobProof with no credit card required.";
export const TRIAL_ENDING_SOON_NOTE = "Subscribe anytime to keep creating new work.";

export function formatActiveTrialStatus(daysRemaining: number): string {
  const unit = daysRemaining === 1 ? "day" : "days";
  return `Your free trial is active — ${daysRemaining} ${unit} remaining.`;
}

export function TrialStatusBanner({
  profile,
}: {
  profile: TrialLifecycleProfile | null | undefined;
}) {
  if (!profile || profile.beta_tester === true) return null;
  if (hasLinkedPaidSubscription(profile)) return null;

  if (!hasSelectedTrialPlan(profile) || !isOnboardingCompleteForTrial(profile)) {
    return (
      <div className="rounded-lg border border-[#2436BB]/25 bg-[#2436BB]/5 px-4 py-3 text-sm text-zinc-800">
        <p className="font-medium text-zinc-900">{PENDING_TRIAL_SETUP_MESSAGE}</p>
        <p className="mt-1 text-zinc-600">
          Add your business name and primary trade so your free trial can begin.
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
  if (days == null || days <= 0) return null;

  const status = formatActiveTrialStatus(days);
  if (days <= TRIAL_URGENT_DAYS) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950">
        <p>
          <span className="font-semibold">{status}</span> {TRIAL_ENDING_SOON_NOTE}
        </p>
        <Link
          href="/settings/billing"
          className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-[#2436BB] hover:text-[#1c2a96]"
        >
          Subscribe Now →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-zinc-700">
      <LandingIcon name="checkCircle" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
      <p className="min-w-0">
        <span className="font-semibold text-zinc-900">{status}</span> {ACTIVE_TRIAL_NO_CARD_NOTE}
      </p>
    </div>
  );
}
