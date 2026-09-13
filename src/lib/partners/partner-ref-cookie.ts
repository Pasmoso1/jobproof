/**
 * Partner referral first-touch cookie (separate from UTM attribution).
 * Captures ?ref=CODE on landing / signup for later auth-callback attribution.
 *
 * Business rule: 30-day FIRST-TOUCH anonymous window.
 * Permanent attribution lives on the contractor account after signup
 * (profiles.signup_partner_referral_code + partner_referrals) and does not
 * depend on this cookie remaining present.
 */

/** Anonymous Partner referral attribution window (days). */
export const PARTNER_REFERRAL_COOKIE_DAYS = 30;

/** Cookie max-age derived from PARTNER_REFERRAL_COOKIE_DAYS. */
export const PARTNER_REFERRAL_COOKIE_MAX_AGE_SEC =
  PARTNER_REFERRAL_COOKIE_DAYS * 24 * 60 * 60;

export const PARTNER_REF_COOKIE_NAME = "jp_partner_ref_v1";
export const PARTNER_REF_LOCALSTORAGE_KEY = "jp_partner_ref_v1";

export type PartnerRefCaptureDecision =
  | { action: "keep"; code: string }
  | { action: "set"; code: string }
  | { action: "ignore"; code: null };

export function normalizeStoredPartnerRef(
  raw: string | null | undefined
): string | null {
  const s = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!s || s.length < 4 || s.length > 24) return null;
  return s;
}

/**
 * First-touch decision for anonymous Partner attribution.
 * A valid existing code always wins; invalid incoming values never clear it.
 */
export function decidePartnerRefCapture(input: {
  existingCode: string | null;
  incomingRaw: string | null | undefined;
}): PartnerRefCaptureDecision {
  const existing = normalizeStoredPartnerRef(input.existingCode);
  if (existing) {
    return { action: "keep", code: existing };
  }
  const incoming = normalizeStoredPartnerRef(input.incomingRaw);
  if (!incoming) {
    return { action: "ignore", code: null };
  }
  return { action: "set", code: incoming };
}

/**
 * Cookie-based Partner attribution is for new contractor acquisition.
 * Existing Auth users outside the anonymous window must not receive
 * retroactive Partner credit from a later referral click.
 */
export function isAuthUserEligibleForCookiePartnerAttribution(
  userCreatedAt: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!userCreatedAt) return false;
  const createdMs = Date.parse(userCreatedAt);
  if (!Number.isFinite(createdMs)) return false;
  return nowMs - createdMs <= PARTNER_REFERRAL_COOKIE_MAX_AGE_SEC * 1000;
}

/** Build Set-Cookie value for tests and server writers (no PII — code only). */
export function buildPartnerRefSetCookieHeader(
  code: string,
  options?: { secure?: boolean; maxAgeSec?: number }
): string | null {
  const normalized = normalizeStoredPartnerRef(code);
  if (!normalized) return null;
  const maxAge = options?.maxAgeSec ?? PARTNER_REFERRAL_COOKIE_MAX_AGE_SEC;
  const parts = [
    `${PARTNER_REF_COOKIE_NAME}=${encodeURIComponent(normalized)}`,
    "path=/",
    `max-age=${maxAge}`,
    "samesite=lax",
  ];
  if (options?.secure) parts.push("secure");
  return parts.join("; ");
}

export function setPartnerRefCookieClient(code: string) {
  if (typeof document === "undefined") return;
  const header = buildPartnerRefSetCookieHeader(code, {
    secure:
      typeof window !== "undefined" && window.location.protocol === "https:",
  });
  if (!header) return;
  document.cookie = header;
  const normalized = normalizeStoredPartnerRef(code);
  if (!normalized) return;
  try {
    window.localStorage.setItem(PARTNER_REF_LOCALSTORAGE_KEY, normalized);
  } catch {
    /* ignore */
  }
}

function readPartnerRefFromDocumentCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${PARTNER_REF_COOKIE_NAME}=`));
  if (!match) return null;
  return normalizeStoredPartnerRef(
    decodeURIComponent(match.slice(PARTNER_REF_COOKIE_NAME.length + 1))
  );
}

/**
 * Prefer the expiring first-party cookie as the source of truth.
 * Orphaned localStorage must not extend attribution past the 30-day cookie window.
 */
export function readPartnerRefClient(): string | null {
  if (typeof window === "undefined") return null;
  const fromCookie = readPartnerRefFromDocumentCookie();
  if (fromCookie) {
    try {
      window.localStorage.setItem(PARTNER_REF_LOCALSTORAGE_KEY, fromCookie);
    } catch {
      /* ignore */
    }
    return fromCookie;
  }
  try {
    window.localStorage.removeItem(PARTNER_REF_LOCALSTORAGE_KEY);
  } catch {
    /* ignore */
  }
  return null;
}

export function decodePartnerRefCookie(
  cookieValue: string | undefined
): string | null {
  if (!cookieValue) return null;
  try {
    return normalizeStoredPartnerRef(decodeURIComponent(cookieValue));
  } catch {
    return normalizeStoredPartnerRef(cookieValue);
  }
}

/**
 * Capture Partner referral from the URL using first-touch rules.
 * Does not refresh max-age for an existing first touch (window stays 30 days
 * from the original capture).
 */
export function capturePartnerRefFromSearchParamsClient(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const incoming =
    params.get("ref") ?? params.get("partner") ?? params.get("referral");
  const decision = decidePartnerRefCapture({
    existingCode: readPartnerRefClient(),
    incomingRaw: incoming,
  });
  if (decision.action === "set") {
    setPartnerRefCookieClient(decision.code);
    return decision.code;
  }
  if (decision.action === "keep") {
    return decision.code;
  }
  return null;
}
