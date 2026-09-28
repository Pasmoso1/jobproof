/**
 * Short-lived, non-PII marker for GA4 trial_started.
 *
 * jp_ga4_ts_pending — set on the server-action response only after
 * maybeStartManagedTrial actually activates the 14-day trial; consumed
 * client-side in the app shell to fire trial_started once.
 *
 * Value is the plan tier ("essential" | "professional") or "1". Never an email,
 * user id, profile id or partner code.
 */

export const GA4_TRIAL_STARTED_PENDING_COOKIE = "jp_ga4_ts_pending";

export const GA4_TRIAL_STARTED_PENDING_MAX_AGE_SEC = 60 * 60;

const ALLOWED_VALUES = new Set(["essential", "professional", "1"]);

export function normalizeTrialStartedMarkerValue(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim().toLowerCase();
  return ALLOWED_VALUES.has(value) ? value : null;
}

export function trialStartedPendingCookieOptions() {
  return {
    path: "/",
    maxAge: GA4_TRIAL_STARTED_PENDING_MAX_AGE_SEC,
    sameSite: "lax" as const,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  };
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/** Returns the pending marker value, or null when absent/invalid. */
export function readTrialStartedPendingClient(): string | null {
  if (!isBrowser()) return null;
  const match = document.cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${GA4_TRIAL_STARTED_PENDING_COOKIE}=`));
  if (!match) return null;
  return normalizeTrialStartedMarkerValue(
    decodeURIComponent(match.slice(GA4_TRIAL_STARTED_PENDING_COOKIE.length + 1))
  );
}

export function clearTrialStartedPendingClient(): void {
  if (!isBrowser()) return;
  document.cookie = `${GA4_TRIAL_STARTED_PENDING_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
