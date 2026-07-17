/**
 * Partner referral first-touch cookie (separate from UTM attribution).
 * Captures ?ref=CODE on landing / signup for later auth-callback attribution.
 */

export const PARTNER_REF_COOKIE_NAME = "jp_partner_ref_v1";
export const PARTNER_REF_LOCALSTORAGE_KEY = "jp_partner_ref_v1";
const MAX_AGE_SEC = 60 * 60 * 24 * 120;

export function normalizeStoredPartnerRef(raw: string | null | undefined): string | null {
  const s = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!s || s.length < 4 || s.length > 24) return null;
  return s;
}

export function setPartnerRefCookieClient(code: string) {
  if (typeof document === "undefined") return;
  const normalized = normalizeStoredPartnerRef(code);
  if (!normalized) return;
  document.cookie = `${PARTNER_REF_COOKIE_NAME}=${encodeURIComponent(normalized)}; path=/; max-age=${MAX_AGE_SEC}; samesite=lax`;
  try {
    window.localStorage.setItem(PARTNER_REF_LOCALSTORAGE_KEY, normalized);
  } catch {
    /* ignore */
  }
}

export function readPartnerRefClient(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const ls = window.localStorage.getItem(PARTNER_REF_LOCALSTORAGE_KEY);
    const fromLs = normalizeStoredPartnerRef(ls);
    if (fromLs) return fromLs;
  } catch {
    /* ignore */
  }
  const match = document.cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${PARTNER_REF_COOKIE_NAME}=`));
  if (!match) return null;
  return normalizeStoredPartnerRef(
    decodeURIComponent(match.slice(PARTNER_REF_COOKIE_NAME.length + 1))
  );
}

export function decodePartnerRefCookie(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  try {
    return normalizeStoredPartnerRef(decodeURIComponent(cookieValue));
  } catch {
    return normalizeStoredPartnerRef(cookieValue);
  }
}

export function capturePartnerRefFromSearchParamsClient() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref") ?? params.get("partner") ?? params.get("referral");
  if (ref) setPartnerRefCookieClient(ref);
}
