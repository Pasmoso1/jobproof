"use client";

import {
  GA4_FUNNEL_EVENTS,
  buildAcquisitionContext,
  classifySignupError,
  trackGa4Event,
  trackGa4EventOnce,
  type SignupErrorCategory,
} from "@/lib/ga4";
import { readFirstTouchClient } from "@/lib/attribution-first-touch";
import { readPartnerRefClient } from "@/lib/partners/partner-ref-cookie";
import { trackEvent as trackMetaEvent } from "@/lib/metaPixel";

export function getSignupAcquisitionParams() {
  return buildAcquisitionContext({
    firstTouch: readFirstTouchClient(),
    partnerReferralPresent: Boolean(readPartnerRefClient()),
  });
}

export function trackSignupView(): boolean {
  return trackGa4EventOnce(
    "signup_view",
    GA4_FUNNEL_EVENTS.signup_view,
    getSignupAcquisitionParams()
  );
}

export function trackSignupStart(): boolean {
  return trackGa4EventOnce(
    "signup_start",
    GA4_FUNNEL_EVENTS.signup_start,
    getSignupAcquisitionParams()
  );
}

export function trackSignupSubmit(): boolean {
  return trackGa4Event(
    GA4_FUNNEL_EVENTS.signup_submit,
    getSignupAcquisitionParams()
  );
}

export function trackSignupError(input: {
  message?: string | null;
  code?: string | null;
  kind?: "password_mismatch" | "existing_account" | "validation" | null;
}): SignupErrorCategory {
  const category = classifySignupError(input);
  trackGa4Event(GA4_FUNNEL_EVENTS.signup_error, {
    ...getSignupAcquisitionParams(),
    error_category: category,
  });
  return category;
}

/**
 * Successful new-account creation only.
 * Instant session → also signup_verified.
 * Email confirmation required → email_verification_required (not signup_verified yet).
 */
export function trackSignupSuccess(input: {
  requiresEmailVerification: boolean;
}): void {
  const params = {
    ...getSignupAcquisitionParams(),
    method: "email",
  };
  trackGa4EventOnce("sign_up", GA4_FUNNEL_EVENTS.sign_up, params);

  // Meta CompleteRegistration — successful contractor signup only (no CAPI).
  try {
    trackMetaEvent("CompleteRegistration", { content_name: "contractor_signup" });
  } catch {
    /* ignore */
  }

  if (input.requiresEmailVerification) {
    trackGa4EventOnce(
      "email_verification_required",
      GA4_FUNNEL_EVENTS.email_verification_required,
      params
    );
  } else {
    trackGa4EventOnce(
      "signup_verified",
      GA4_FUNNEL_EVENTS.signup_verified,
      params
    );
  }
}
