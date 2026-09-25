"use client";

import { useEffect } from "react";
import {
  GA4_FUNNEL_EVENTS,
  buildAcquisitionContext,
  trackGa4EventOnce,
} from "@/lib/ga4";
import { readFirstTouchClient } from "@/lib/attribution-first-touch";
import { readPartnerRefClient } from "@/lib/partners/partner-ref-cookie";
import { consumeSignupVerifiedPendingAndTrack } from "@/lib/signup-funnel-analytics";

/**
 * Consumes auth-callback signup_verified pending marker (preferred),
 * and still accepts legacy ?confirmed=true as a secondary signal.
 *
 * Preferred path: auth/callback sets jp_ga4_sv_pending → this fires once.
 */
export function SignupVerifiedTracker({ confirmed = false }: { confirmed?: boolean }) {
  useEffect(() => {
    if (consumeSignupVerifiedPendingAndTrack()) return;
    // Legacy fallback: destination still has confirmed=true (e.g. older emails).
    if (!confirmed) return;
    trackGa4EventOnce(
      "signup_verified",
      GA4_FUNNEL_EVENTS.signup_verified,
      {
        ...buildAcquisitionContext({
          firstTouch: readFirstTouchClient(),
          partnerReferralPresent: Boolean(readPartnerRefClient()),
        }),
        method: "email",
        verification_path: "confirmed_query",
      }
    );
  }, [confirmed]);
  return null;
}

/**
 * Mount once in the authenticated app shell so signup_verified fires even when
 * middleware strips ?confirmed=true (e.g. redirect to /onboarding/plan).
 */
export function SignupVerifiedPendingBridge() {
  useEffect(() => {
    consumeSignupVerifiedPendingAndTrack();
  }, []);
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
