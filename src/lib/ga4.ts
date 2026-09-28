/**
 * Client-side GA4 event helper for contractor acquisition funnel.
 * Uses the existing root-layout gtag install — does not load a second tag.
 */

export const GA4_FUNNEL_EVENTS = {
  contractor_landing_view: "contractor_landing_view",
  contractor_cta_click: "contractor_cta_click",
  signup_view: "signup_view",
  signup_start: "signup_start",
  signup_submit: "signup_submit",
  signup_error: "signup_error",
  sign_up: "sign_up",
  email_verification_required: "email_verification_required",
  signup_verified: "signup_verified",
  onboarding_start: "onboarding_start",
  onboarding_complete: "onboarding_complete",
  sample_quote_view: "sample_quote_view",
  sample_quote_cta_click: "sample_quote_cta_click",
  trial_started: "trial_started",
} as const;

/**
 * Marketing funnel stages mapped to the GA4 event actually sent. Stages that
 * predate this funnel keep their original event names so GA4 history and any
 * configured key events keep working.
 */
export const CONTRACTOR_CONVERSION_FUNNEL = [
  { stage: "landing_page_view", event: GA4_FUNNEL_EVENTS.contractor_landing_view },
  { stage: "sample_quote_view", event: GA4_FUNNEL_EVENTS.sample_quote_view },
  { stage: "sample_quote_cta_click", event: GA4_FUNNEL_EVENTS.sample_quote_cta_click },
  { stage: "trial_cta_click", event: GA4_FUNNEL_EVENTS.contractor_cta_click },
  { stage: "signup_started", event: GA4_FUNNEL_EVENTS.signup_start },
  { stage: "signup_completed", event: GA4_FUNNEL_EVENTS.sign_up },
  { stage: "trial_started", event: GA4_FUNNEL_EVENTS.trial_started },
] as const;

export type Ga4FunnelEventName =
  (typeof GA4_FUNNEL_EVENTS)[keyof typeof GA4_FUNNEL_EVENTS];

export type SignupErrorCategory =
  | "validation"
  | "existing_account"
  | "password"
  | "rate_limit"
  | "auth_error"
  | "server_error"
  | "unknown";

type Ga4Scalar = string | number | boolean;
type Ga4ParamValue =
  | Ga4Scalar
  | null
  | undefined
  | ReadonlyArray<Record<string, Ga4Scalar | null | undefined>>;
export type Ga4EventParams = Record<string, Ga4ParamValue>;

const PII_PARAM_KEYS = new Set([
  "email",
  "user_email",
  "useremail",
  "password",
  "confirm_password",
  "phone",
  "name",
  "full_name",
  "first_name",
  "last_name",
  "address",
  "street",
  "user_id",
  "userid",
  "auth_user_id",
  "supabase_user_id",
  "referral_code",
  "partner_code",
  "partner_referral_code",
]);

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function sanitizeEcommerceItem(
  item: Record<string, Ga4Scalar | null | undefined>
): Record<string, Ga4Scalar> | null {
  const out: Record<string, Ga4Scalar> = {};
  for (const [key, value] of Object.entries(item)) {
    if (value == null || value === "") continue;
    const normalizedKey = key.trim().toLowerCase();
    if (PII_PARAM_KEYS.has(normalizedKey)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Strip PII and empty values from event payloads (supports ecommerce `items`). */
export function sanitizeGa4Params(
  params?: Ga4EventParams | null
): Record<string, Ga4Scalar | Record<string, Ga4Scalar>[]> {
  const out: Record<string, Ga4Scalar | Record<string, Ga4Scalar>[]> = {};
  if (!params) return out;
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    const normalizedKey = key.trim().toLowerCase();
    if (PII_PARAM_KEYS.has(normalizedKey)) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value) && normalizedKey === "items") {
      const items: Record<string, Ga4Scalar>[] = [];
      for (const entry of value) {
        if (!entry || typeof entry !== "object") continue;
        const cleaned = sanitizeEcommerceItem(entry);
        if (cleaned) items.push(cleaned);
      }
      if (items.length > 0) out[key] = items;
    }
  }
  return out;
}

export function classifySignupError(input: {
  message?: string | null;
  code?: string | null;
  kind?: "password_mismatch" | "existing_account" | "validation" | null;
}): SignupErrorCategory {
  if (input.kind === "password_mismatch" || input.kind === "validation") {
    return "validation";
  }
  if (input.kind === "existing_account") return "existing_account";

  const code = String(input.code ?? "").toLowerCase();
  const message = String(input.message ?? "").toLowerCase();

  if (
    code === "email_not_confirmed" ||
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("user already") ||
    message.includes("email address is already") ||
    message.includes("duplicate")
  ) {
    return "existing_account";
  }
  if (
    message.includes("password") ||
    code.includes("password") ||
    message.includes("weak")
  ) {
    return "password";
  }
  if (
    message.includes("rate") ||
    message.includes("too many") ||
    code.includes("rate")
  ) {
    return "rate_limit";
  }
  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("5") ||
    code.startsWith("5")
  ) {
    return "server_error";
  }
  if (message || code) return "auth_error";
  return "unknown";
}

export type AcquisitionContext = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  landing_page?: string;
  referral_present: boolean;
  partner_referral_present: boolean;
  entry_source?: string;
};

/**
 * Safe acquisition context from existing first-touch + partner-ref cookies.
 * Never includes referral codes or emails.
 */
export function buildAcquisitionContext(input?: {
  firstTouch?: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
    landing_page?: string | null;
  } | null;
  partnerReferralPresent?: boolean;
  landingPageOverride?: string | null;
  entrySource?: string | null;
}): AcquisitionContext {
  const ft = input?.firstTouch;
  const partnerPresent = Boolean(input?.partnerReferralPresent);
  const context: AcquisitionContext = {
    referral_present: partnerPresent,
    partner_referral_present: partnerPresent,
  };
  if (ft?.utm_source) context.utm_source = String(ft.utm_source);
  if (ft?.utm_medium) context.utm_medium = String(ft.utm_medium);
  if (ft?.utm_campaign) context.utm_campaign = String(ft.utm_campaign);
  if (ft?.utm_content) context.utm_content = String(ft.utm_content);
  if (ft?.utm_term) context.utm_term = String(ft.utm_term);
  const landing = input?.landingPageOverride ?? ft?.landing_page;
  if (landing) context.landing_page = String(landing).slice(0, 200);
  if (input?.entrySource) {
    context.entry_source = String(input.entrySource).slice(0, 80);
  } else if (partnerPresent) {
    context.entry_source = "partner_referral";
  } else if (ft?.utm_source || ft?.utm_medium || ft?.utm_campaign) {
    context.entry_source = "campaign";
  } else if (landing) {
    context.entry_source = "marketing";
  } else {
    context.entry_source = "direct";
  }
  return context;
}

export function getGtag(): ((...args: unknown[]) => void) | undefined {
  if (!isBrowser()) return undefined;
  return typeof window.gtag === "function" ? window.gtag : undefined;
}

/**
 * Fire a GA4 event via the existing gtag install.
 * No-ops safely when gtag/window is unavailable.
 */
export function trackGa4Event(
  eventName: string,
  params?: Ga4EventParams | null
): boolean {
  if (!isBrowser()) return false;
  const gtag = getGtag();
  if (!gtag) return false;
  const safe = sanitizeGa4Params(params);
  try {
    gtag("event", eventName, safe);
    if (process.env.NODE_ENV === "development") {
      console.info("[JobProof GA4]", eventName, safe);
    }
    return true;
  } catch {
    return false;
  }
}

const ONCE_PREFIX = "jp_ga4_once:";

function onceStorageKey(dedupeKey: string): string {
  return `${ONCE_PREFIX}${dedupeKey}`;
}

export function hasGa4OnceFired(dedupeKey: string): boolean {
  if (!isBrowser()) return false;
  try {
    return window.sessionStorage.getItem(onceStorageKey(dedupeKey)) === "1";
  } catch {
    return false;
  }
}

export function markGa4OnceFired(dedupeKey: string): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(onceStorageKey(dedupeKey), "1");
  } catch {
    /* ignore */
  }
}

/**
 * Fire at most once per browser tab session for the given dedupe key.
 * Legitimate later independent visits in a new tab/session can fire again.
 */
export function trackGa4EventOnce(
  dedupeKey: string,
  eventName: string,
  params?: Ga4EventParams | null
): boolean {
  if (hasGa4OnceFired(dedupeKey)) return false;
  markGa4OnceFired(dedupeKey);
  return trackGa4Event(eventName, params);
}

/** Clear session once-keys (tests only). */
export function clearGa4OnceFiredForTests(): void {
  if (!isBrowser()) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(ONCE_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
