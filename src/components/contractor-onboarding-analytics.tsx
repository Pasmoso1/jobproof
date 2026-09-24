"use client";

import { useEffect } from "react";
import {
  GA4_FUNNEL_EVENTS,
  buildAcquisitionContext,
  trackGa4EventOnce,
} from "@/lib/ga4";
import { readFirstTouchClient } from "@/lib/attribution-first-touch";
import { readPartnerRefClient } from "@/lib/partners/partner-ref-cookie";

/**
 * Fires signup_verified once when a newly created contractor lands after
 * email confirmation (?confirmed=true). Safe on dashboard or onboarding.
 */
export function SignupVerifiedTracker({ confirmed }: { confirmed: boolean }) {
  useEffect(() => {
    if (!confirmed) return;
    trackGa4EventOnce(
      "signup_verified",
      GA4_FUNNEL_EVENTS.signup_verified,
      buildAcquisitionContext({
        firstTouch: readFirstTouchClient(),
        partnerReferralPresent: Boolean(readPartnerRefClient()),
      })
    );
  }, [confirmed]);
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
