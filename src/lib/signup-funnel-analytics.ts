"use client";

import {
  GA4_FUNNEL_EVENTS,
  buildAcquisitionContext,
  classifySignupError,
  getGtag,
  hasGa4OnceFired,
  trackGa4Event,
  trackGa4EventOnce,
  waitForGa4Ready,
  type SignupErrorCategory,
} from "@/lib/ga4";
import { readFirstTouchClient } from "@/lib/attribution-first-touch";
import { readPartnerRefClient } from "@/lib/partners/partner-ref-cookie";
import { trackEvent as trackMetaEvent } from "@/lib/metaPixel";
import {
  clearEmailVerificationPendingClient,
  clearSignupVerifiedPendingClient,
  markEmailVerificationPendingClient,
  markSignupVerifiedInstantPendingClient,
  readSignupVerifiedPendingClient,
  type SignupVerifiedClaimResult,
} from "@/lib/ga4-signup-verified-marker";
import {
  clearTrialStartedPendingClient,
  readTrialStartedPendingClient,
} from "@/lib/ga4-trial-started-marker";

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

export type SignupVerifiedPath =
  | "email_confirm"
  | "instant_session"
  | "confirmed_query"
  | "server_reconciled";

export function resolveSignupVerifiedPath(input: {
  serverPending?: boolean;
  confirmedQuery?: boolean;
}): SignupVerifiedPath | null {
  const marker = readSignupVerifiedPendingClient();
  if (marker) return marker;
  if (input.confirmedQuery) return "confirmed_query";
  if (input.serverPending) return "server_reconciled";
  return null;
}

let signupVerifiedInFlight: Promise<boolean> | null = null;

/**
 * Fire signup_verified at most once per account after a successful confirmation.
 *
 * Signals: jp_ga4_sv_pending (auth callback / instant session), legacy
 * ?confirmed=true, or the server seeing a recent confirmation that was never
 * recorded. The server claim is the cross-device/tab dedupe; markers are only
 * cleared once gtag exists, so an early mount cannot silently drop the event.
 */
export async function reconcileSignupVerifiedAnalytics(input: {
  serverPending?: boolean;
  confirmedQuery?: boolean;
  claim: () => Promise<SignupVerifiedClaimResult>;
  waitForGa4?: () => Promise<boolean>;
}): Promise<boolean> {
  if (signupVerifiedInFlight) {
    await signupVerifiedInFlight;
    return false;
  }
  const verificationPath = resolveSignupVerifiedPath(input);
  if (!verificationPath) return false;
  if (hasGa4OnceFired("signup_verified")) {
    clearSignupVerifiedPendingClient();
    clearEmailVerificationPendingClient();
    return false;
  }

  signupVerifiedInFlight = (async () => {
    const ready = await (input.waitForGa4 ?? waitForGa4Ready)();
    if (!ready) return false;

    let result: SignupVerifiedClaimResult;
    try {
      result = await input.claim();
    } catch {
      return false;
    }
    if (result === "retry") return false;

    clearSignupVerifiedPendingClient();
    clearEmailVerificationPendingClient();
    if (result !== "claimed") return false;

    return trackGa4EventOnce("signup_verified", GA4_FUNNEL_EVENTS.signup_verified, {
      ...getSignupAcquisitionParams(),
      method: "email",
      verification_path: verificationPath,
    });
  })();

  try {
    return await signupVerifiedInFlight;
  } finally {
    signupVerifiedInFlight = null;
  }
}

/**
 * Fire trial_started once when a server action left jp_ga4_ts_pending, which is
 * only set after the managed 14-day trial was actually activated.
 * The marker is left in place until gtag exists so it is not consumed unsent.
 */
export function consumeTrialStartedPendingAndTrack(): boolean {
  const marker = readTrialStartedPendingClient();
  if (!marker) return false;
  if (!getGtag()) return false;
  clearTrialStartedPendingClient();
  const planTier = marker === "1" ? undefined : marker;
  const fired = trackGa4EventOnce("trial_started", GA4_FUNNEL_EVENTS.trial_started, {
    ...getSignupAcquisitionParams(),
    plan_tier: planTier,
    trial_length_days: 14,
  });
  if (fired) {
    try {
      trackMetaEvent("StartTrial", { content_name: "contractor_trial", currency: "CAD", value: 0 });
    } catch {
      /* ignore */
    }
  }
  return fired;
}

/**
 * Successful new-account creation only.
 * Instant session → marks signup_verified for the app shell, which claims it
 * server-side so it cannot double-count with the reconciliation path.
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
    markEmailVerificationPendingClient();
    trackGa4EventOnce(
      "email_verification_required",
      GA4_FUNNEL_EVENTS.email_verification_required,
      params
    );
  } else {
    clearEmailVerificationPendingClient();
    markSignupVerifiedInstantPendingClient();
  }
}
