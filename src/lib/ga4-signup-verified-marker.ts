/**
 * Short-lived, non-PII markers for GA4 signup_verified after email confirmation.
 *
 * jp_ga4_ev_pending — optional same-browser fallback set when email_verification_required fires.
 * jp_ga4_sv_pending — set by auth callback after successful NEW-ACCOUNT confirmation;
 *                     consumed client-side to fire signup_verified once.
 *
 * Cross-device: JobProof confirm-signup emails use token_hash + type=email|signup on
 * /auth/callback (see emails/supabase-auth/confirm-signup.html). That OTP type is the
 * authoritative server signal — Device A cookies are NOT required.
 *
 * Values are always "1". No email, user id, tokens, or partner codes.
 */

export const GA4_EMAIL_VERIFY_PENDING_COOKIE = "jp_ga4_ev_pending";
export const GA4_SIGNUP_VERIFIED_PENDING_COOKIE = "jp_ga4_sv_pending";

/** How long we wait for the confirmation email click (same browser). */
export const GA4_EMAIL_VERIFY_PENDING_MAX_AGE_SEC = 7 * 24 * 60 * 60;

/** How long the post-callback fire marker survives redirects. */
export const GA4_SIGNUP_VERIFIED_PENDING_MAX_AGE_SEC = 60 * 60;

/** OTP / callback types that mean NEW-ACCOUNT email confirmation (JobProof templates). */
export const SIGNUP_CONFIRM_OTP_TYPES = new Set(["signup", "email"]);

/**
 * OTP / callback types that must NEVER schedule signup_verified,
 * even if a stale same-browser pending cookie is present.
 */
export const NON_SIGNUP_CONFIRM_OTP_TYPES = new Set([
  "recovery",
  "magiclink",
  "email_change",
  "invite",
]);

export type AuthCallbackAnalyticsDecision = {
  /** Set jp_ga4_sv_pending on the redirect response. */
  markSignupVerifiedPending: boolean;
  /** Clear jp_ga4_ev_pending on the redirect response. */
  clearEmailVerifyPending: boolean;
  /** Why we decided (tests / debug only — never sent to GA). */
  reason:
    | "auth_failed"
    | "non_signup_otp_type"
    | "recovery_next"
    | "explicit_signup_otp"
    | "email_verify_pending_cookie"
    | "no_signal";
};

/**
 * Pure decision: should this successful auth callback schedule signup_verified?
 *
 * Authoritative (works cross-device, no Device A cookie):
 *   callback OTP type is signup | email (JobProof confirm-signup template).
 *
 * Fallback (same browser only):
 *   jp_ga4_ev_pending cookie from email_verification_required.
 *
 * Must not fire for recovery / magiclink / email_change / invite / ordinary login.
 */
export function decideSignupVerifiedAnalyticsMarker(input: {
  authSucceeded: boolean;
  /** Supabase OTP/email type when present in the callback URL. */
  type: string | null | undefined;
  /** Safe relative next path (path only), if any. */
  nextPath: string | null | undefined;
  /** True when jp_ga4_ev_pending cookie was present on the request. */
  emailVerifyPendingCookie: boolean;
}): AuthCallbackAnalyticsDecision {
  if (!input.authSucceeded) {
    return {
      markSignupVerifiedPending: false,
      clearEmailVerifyPending: false,
      reason: "auth_failed",
    };
  }

  const type = String(input.type ?? "").toLowerCase();
  const nextPath = (input.nextPath ?? "").split("?")[0] || "";

  if (NON_SIGNUP_CONFIRM_OTP_TYPES.has(type)) {
    return {
      markSignupVerifiedPending: false,
      clearEmailVerifyPending: false,
      reason: "non_signup_otp_type",
    };
  }

  if (nextPath === "/update-password") {
    return {
      markSignupVerifiedPending: false,
      clearEmailVerifyPending: false,
      reason: "recovery_next",
    };
  }

  if (SIGNUP_CONFIRM_OTP_TYPES.has(type)) {
    return {
      markSignupVerifiedPending: true,
      clearEmailVerifyPending: true,
      reason: "explicit_signup_otp",
    };
  }

  // PKCE/code path without type: same-browser pending marker only.
  if (input.emailVerifyPendingCookie) {
    return {
      markSignupVerifiedPending: true,
      clearEmailVerifyPending: true,
      reason: "email_verify_pending_cookie",
    };
  }

  return {
    markSignupVerifiedPending: false,
    clearEmailVerifyPending: false,
    reason: "no_signal",
  };
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function readDocumentCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const match = document.cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

function writeDocumentCookie(name: string, value: string, maxAgeSec: number): void {
  if (!isBrowser()) return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Lax`;
}

function clearDocumentCookie(name: string): void {
  if (!isBrowser()) return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

/** Called when email_verification_required fires (same browser). */
export function markEmailVerificationPendingClient(): void {
  writeDocumentCookie(
    GA4_EMAIL_VERIFY_PENDING_COOKIE,
    "1",
    GA4_EMAIL_VERIFY_PENDING_MAX_AGE_SEC
  );
  try {
    window.localStorage.setItem(GA4_EMAIL_VERIFY_PENDING_COOKIE, "1");
  } catch {
    /* ignore */
  }
}

export function clearEmailVerificationPendingClient(): void {
  clearDocumentCookie(GA4_EMAIL_VERIFY_PENDING_COOKIE);
  try {
    window.localStorage.removeItem(GA4_EMAIL_VERIFY_PENDING_COOKIE);
  } catch {
    /* ignore */
  }
}

export function hasSignupVerifiedPendingClient(): boolean {
  if (readDocumentCookie(GA4_SIGNUP_VERIFIED_PENDING_COOKIE) === "1") return true;
  return false;
}

export function clearSignupVerifiedPendingClient(): void {
  clearDocumentCookie(GA4_SIGNUP_VERIFIED_PENDING_COOKIE);
}

/**
 * Build Set-Cookie style options for NextResponse.cookies.set.
 * Server-only helper values (no PII).
 */
export function signupVerifiedPendingCookieOptions() {
  return {
    path: "/",
    maxAge: GA4_SIGNUP_VERIFIED_PENDING_MAX_AGE_SEC,
    sameSite: "lax" as const,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  };
}

export function clearEmailVerifyPendingCookieOptions() {
  return {
    path: "/",
    maxAge: 0,
    sameSite: "lax" as const,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  };
}
