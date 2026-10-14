"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  GA4_FUNNEL_EVENTS,
  buildAcquisitionContext,
  trackGa4EventOnce,
  waitForGa4Ready,
} from "@/lib/ga4";
import { readFirstTouchClient } from "@/lib/attribution-first-touch";
import { readPartnerRefClient } from "@/lib/partners/partner-ref-cookie";
import {
  consumeTrialStartedPendingAndTrack,
  reconcileSignupVerifiedAnalytics,
} from "@/lib/signup-funnel-analytics";
import { claimSignupVerifiedAnalyticsAction } from "@/app/(app)/product-analytics-actions";

/**
 * Accepts legacy ?confirmed=true as a secondary signal. The server claim still
 * decides, so this cannot double-count with SignupVerifiedPendingBridge.
 */
export function SignupVerifiedTracker({ confirmed = false }: { confirmed?: boolean }) {
  useEffect(() => {
    void reconcileSignupVerifiedAnalytics({
      confirmedQuery: confirmed,
      claim: claimSignupVerifiedAnalyticsAction,
    });
  }, [confirmed]);
  return null;
}

/**
 * Mount once in the authenticated app shell so signup_verified fires even when
 * middleware strips ?confirmed=true (e.g. redirect to /onboarding/plan), and so a
 * recent confirmation without a browser marker (serverPending) is still recorded.
 */
export function SignupVerifiedPendingBridge({
  serverPending = false,
}: {
  serverPending?: boolean;
}) {
  useEffect(() => {
    void reconcileSignupVerifiedAnalytics({
      serverPending,
      claim: claimSignupVerifiedAnalyticsAction,
    });
  }, [serverPending]);
  return null;
}

/**
 * The app layout stays mounted across client navigations, so re-check on every
 * pathname change: the marker is set by the onboarding server action right
 * before router.push("/dashboard").
 */
export function TrialStartedPendingBridge() {
  const pathname = usePathname();
  useEffect(() => {
    void waitForGa4Ready().then(() => consumeTrialStartedPendingAndTrack());
  }, [pathname]);
  return null;
}

/** Fires onboarding_start once when initial onboarding UI is shown. */
export function OnboardingStartTracker({ step }: { step: "plan" | "business_profile" }) {
  useEffect(() => {
    trackGa4EventOnce(
      "onboarding_start",
      GA4_FUNNEL_EVENTS.onboarding_start,
      {
        ...buildAcquisitionContext({
          firstTouch: readFirstTouchClient(),
          partnerReferralPresent: Boolean(readPartnerRefClient()),
        }),
        onboarding_step: step,
      }
    );
  }, [step]);
  return null;
}
