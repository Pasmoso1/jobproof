/**
 * Short-lived, non-PII markers for GA4 signup_verified after email confirmation.
 *
 * jp_ga4_ev_pending — set when a new contractor must verify email (same browser).
 * jp_ga4_sv_pending — set by auth callback after successful NEW-ACCOUNT confirmation;
 *                     consumed client-side to fire signup_verified once.
 *
 * Values are always "1". No email, user id, tokens, or partner codes.
 */

export const GA4_EMAIL_VERIFY_PENDING_COOKIE = "jp_ga4_ev_pending";
export const GA4_SIGNUP_VERIFIED_PENDING_COOKIE = "jp_ga4_sv_pending";

/** How long we wait for the confirmation email click (same browser). */
export const GA4_EMAIL_VERIFY_PENDING_MAX_AGE_SEC = 7 * 24 * 60 * 60;

/** How long the post-callback fire marker survives redirects. */
export const GA4_SIGNUP_VERIFIED_PENDING_MAX_AGE_SEC = 60 * 60;

export type AuthCallbackAnalyticsDecision = {
  /** Set jp_ga4_sv_pending on the redirect response. */
  markSignupVerifiedPending: boolean;
  /** Clear jp_ga4_ev_pending on the redirect response. */
  clearEmailVerifyPending: boolean;
};

/**
 * Pure decision: should this successful auth callback schedule signup_verified?
 * Must not fire for recovery / update-password / ordinary sessions without a
 * signup-confirmation signal.
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
    return { markSignupVerifiedPending: false, clearEmailVerifyPending: false };
  }

  const type = String(input.type ?? "").toLowerCase();
  const nextPath = (input.nextPath ?? "").split("?")[0] || "";

  if (type === "recovery" || nextPath === "/update-password") {
    return { markSignupVerifiedPending: false, clearEmailVerifyPending: false };
  }

  const isExplicitSignupConfirm = type === "signup" || type === "email";
  if (isExplicitSignupConfirm) {
    return { markSignupVerifiedPending: true, clearEmailVerifyPending: true };
  }

  // PKCE code exchange often omits type; same-browser pending marker from
  // email_verification_required is the signal that this session is the
  // new-account confirmation journey.
  if (input.emailVerifyPendingCookie) {
    return { markSignupVerifiedPending: true, clearEmailVerifyPending: true };
  }

  return { markSignupVerifiedPending: false, clearEmailVerifyPending: false };
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
