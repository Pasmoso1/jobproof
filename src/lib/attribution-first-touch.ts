import { resolvePublicAppOrigin } from "@/lib/app-origin";

export const FIRST_TOUCH_COOKIE_NAME = "jp_first_touch_v1";
export const FIRST_TOUCH_LOCALSTORAGE_KEY = "jp_first_touch_v1";

export type HeardAboutSourceOption =
  | "facebook_group"
  | "facebook_ad"
  | "friend_referral"
  | "google_search"
  | "contractor_association"
  | "trade_school"
  | "other";

export const HEARD_ABOUT_SOURCE_OPTIONS: { value: HeardAboutSourceOption; label: string }[] = [
  { value: "facebook_group", label: "Facebook group" },
  { value: "facebook_ad", label: "Facebook ad" },
  { value: "friend_referral", label: "Friend / referral" },
  { value: "google_search", label: "Google search" },
  { value: "contractor_association", label: "Contractor association" },
  { value: "trade_school", label: "Trade school" },
  { value: "other", label: "Other" },
];

export type FirstTouchAttribution = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_page: string | null;
  first_seen_at: string;
  heard_about_source: string | null;
};

function clean(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function sanitizeLandingPage(raw: string | null): string | null {
  const s = clean(raw);
  if (!s) return null;
  return s.slice(0, 2000);
}

export function normalizeFirstTouch(partial: Partial<FirstTouchAttribution>): FirstTouchAttribution {
  return {
    utm_source: clean(partial.utm_source),
    utm_medium: clean(partial.utm_medium),
    utm_campaign: clean(partial.utm_campaign),
    utm_content: clean(partial.utm_content),
    utm_term: clean(partial.utm_term),
    referrer: clean(partial.referrer),
    landing_page: sanitizeLandingPage(partial.landing_page ?? null),
    first_seen_at: clean(partial.first_seen_at) ?? new Date().toISOString(),
    heard_about_source: clean(partial.heard_about_source),
  };
}

function cookieEncode(v: FirstTouchAttribution): string {
  return encodeURIComponent(JSON.stringify(v));
}

function cookieDecode(v: string): FirstTouchAttribution | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(v)) as Partial<FirstTouchAttribution>;
    return normalizeFirstTouch(parsed);
  } catch {
    return null;
  }
}

function setCookieClient(v: FirstTouchAttribution) {
  if (typeof document === "undefined") return;
  document.cookie = `${FIRST_TOUCH_COOKIE_NAME}=${cookieEncode(v)}; path=/; max-age=${60 * 60 * 24 * 120}; samesite=lax`;
}

export function decodeFirstTouchCookie(cookieValue: string | undefined): FirstTouchAttribution | null {
  if (!cookieValue) return null;
  return cookieDecode(cookieValue);
}

export function readFirstTouchFromCookieHeader(cookieHeader: string | null | undefined): FirstTouchAttribution | null {
  if (!cookieHeader) return null;
  const part = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${FIRST_TOUCH_COOKIE_NAME}=`));
  if (!part) return null;
  const raw = part.slice(FIRST_TOUCH_COOKIE_NAME.length + 1);
  return decodeFirstTouchCookie(raw);
}

export function readFirstTouchClient(): FirstTouchAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FIRST_TOUCH_LOCALSTORAGE_KEY);
    if (raw) return normalizeFirstTouch(JSON.parse(raw) as Partial<FirstTouchAttribution>);
  } catch {
    // ignore
  }
  const fromCookie = readFirstTouchFromCookieHeader(document.cookie);
  if (fromCookie) return fromCookie;
  return null;
}

export function saveFirstTouchClient(data: FirstTouchAttribution): void {
  if (typeof window === "undefined") return;
  const norm = normalizeFirstTouch(data);
  window.localStorage.setItem(FIRST_TOUCH_LOCALSTORAGE_KEY, JSON.stringify(norm));
  setCookieClient(norm);
}

/**
 * First-touch attribution: once set, marketing params are not replaced by later visits.
 *
 * Facebook URL examples:
 * - ${resolvePublicAppOrigin()}/?utm_source=facebook&utm_medium=group_post&utm_campaign=contractor_outreach
 * - ${resolvePublicAppOrigin()}/?utm_source=facebook&utm_medium=paid_ad&utm_campaign=early_access
 * - ${resolvePublicAppOrigin()}/?utm_source=facebook&utm_medium=page_post&utm_campaign=jobproof_launch
 */
export function captureFirstTouchIfMissing(currentPathWithSearch: string): FirstTouchAttribution {
  const existing = readFirstTouchClient();
  if (existing) {
    saveFirstTouchClient(existing);
    return existing;
  }

  const qs = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const payload = normalizeFirstTouch({
    utm_source: qs?.get("utm_source"),
    utm_medium: qs?.get("utm_medium"),
    utm_campaign: qs?.get("utm_campaign"),
    utm_content: qs?.get("utm_content"),
    utm_term: qs?.get("utm_term"),
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    landing_page: currentPathWithSearch || null,
    first_seen_at: new Date().toISOString(),
  });

  saveFirstTouchClient(payload);
  return payload;
}

/** Keep first-touch UTM stable while allowing a late "how did you hear" answer. */
export function persistHeardAboutSourceClient(value: string | null | undefined): void {
  const heard = clean(value);
  if (!heard) return;
  const existing = readFirstTouchClient();
  const merged = normalizeFirstTouch({
    ...(existing ?? {}),
    heard_about_source: heard,
    first_seen_at: existing?.first_seen_at ?? new Date().toISOString(),
  });
  saveFirstTouchClient(merged);
}
