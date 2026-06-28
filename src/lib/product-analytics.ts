import { createHash } from "node:crypto";
import type { BillingAuditEventType } from "@/lib/billing-audit-log";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** Canonical product analytics event names. */
export const PRODUCT_ANALYTICS_EVENTS = {
  onboarding_started: "onboarding_started",
  sample_job_viewed: "sample_job_viewed",
  first_job_created: "first_job_created",
  first_job_update_added: "first_job_update_added",
  first_contract_sent: "first_contract_sent",
  first_invoice_sent: "first_invoice_sent",
  first_payment_recorded: "first_payment_recorded",
  onboarding_completed: "onboarding_completed",
  stripe_connect_started: "stripe_connect_started",
  stripe_connect_completed: "stripe_connect_completed",
  proof_report_viewed: "proof_report_viewed",
  proof_report_exported: "proof_report_exported",
  subscription_started: "subscription_started",
  subscription_upgraded: "subscription_upgraded",
  subscription_downgraded: "subscription_downgraded",
  subscription_canceled: "subscription_canceled",
  read_only_mode_triggered: "read_only_mode_triggered",
  plan_selected: "plan_selected",
  subscription_checkout_started: "subscription_checkout_started",
  /** @deprecated Legacy beta onboarding — no longer fired for new signups. */
  beta_tester_created: "beta_tester_created",
  /** @deprecated Legacy beta onboarding — no longer fired for new signups. */
  beta_plan_selected: "beta_plan_selected",
  quote_request_received: "quote_request_received",
  quote_request_notification_sent: "quote_request_notification_sent",
  quote_request_notification_failed: "quote_request_notification_failed",
  quote_request_reviewed: "quote_request_reviewed",
  quote_request_responded: "quote_request_responded",
  quote_request_site_visit_requested: "quote_request_site_visit_requested",
  quote_request_site_visit_email_sent: "quote_request_site_visit_email_sent",
  quote_request_site_visit_email_failed: "quote_request_site_visit_email_failed",
  quote_request_site_visit_sms_sent: "quote_request_site_visit_sms_sent",
  quote_request_site_visit_sms_failed: "quote_request_site_visit_sms_failed",
  quote_request_declined_service_not_offered: "quote_request_declined_service_not_offered",
  quote_request_declined_capacity: "quote_request_declined_capacity",
  quote_request_declined_not_good_fit: "quote_request_declined_not_good_fit",
} as const;

export type ProductAnalyticsEventName =
  (typeof PRODUCT_ANALYTICS_EVENTS)[keyof typeof PRODUCT_ANALYTICS_EVENTS];

export type ProductAnalyticsMetadata = Record<string, string | number | boolean | null>;

const MAX_METADATA_KEYS = 24;
const MAX_STRING_LEN = 500;

const BLOCKED_METADATA_KEYS = new Set([
  "password",
  "token",
  "secret",
  "authorization",
  "api_key",
  "card",
  "cvv",
  "ssn",
]);

function sanitizeMetadataValue(value: unknown): string | number | boolean | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    return t.length > MAX_STRING_LEN ? t.slice(0, MAX_STRING_LEN) : t;
  }
  return null;
}

/** Strip sensitive keys and cap metadata size for safe JSONB storage. */
export function sanitizeProductAnalyticsMetadata(
  meta: Record<string, unknown> | undefined
): ProductAnalyticsMetadata {
  if (!meta || typeof meta !== "object") return {};
  const out: ProductAnalyticsMetadata = {};
  let count = 0;
  for (const [key, value] of Object.entries(meta)) {
    if (count >= MAX_METADATA_KEYS) break;
    const kl = key.toLowerCase();
    if (BLOCKED_METADATA_KEYS.has(kl) || kl.includes("password") || kl.includes("token")) {
      continue;
    }
    const sanitized = sanitizeMetadataValue(value);
    if (sanitized !== null) {
      out[key] = sanitized;
      count += 1;
    }
  }
  return out;
}

export function hashIpForAnalytics(ip: string | null | undefined): string | null {
  const trimmed = ip?.trim();
  if (!trimmed) return null;
  const salt = process.env.ANALYTICS_IP_HASH_SALT?.trim() || "jobproof-analytics";
  return createHash("sha256").update(`${salt}:${trimmed}`).digest("hex");
}

export type TrackProductEventInput = {
  profileId?: string | null;
  eventName: ProductAnalyticsEventName | string;
  sessionId?: string | null;
  route?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
  ipHash?: string | null;
  userAgent?: string | null;
};

/**
 * Insert a product analytics row via service role. Never throws; logs on failure.
 */
export async function trackProductEvent(input: TrackProductEventInput): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    if (!admin) {
      console.warn("[product-analytics] SUPABASE_SERVICE_ROLE_KEY missing; skipping event");
      return;
    }

    const eventName = String(input.eventName ?? "").trim();
    if (!eventName) return;

    const { error } = await admin.from("product_analytics_events").insert({
      profile_id: input.profileId ?? null,
      event_name: eventName,
      session_id: input.sessionId?.trim() || null,
      route: input.route?.trim() || null,
      source: input.source?.trim() || null,
      metadata: sanitizeProductAnalyticsMetadata(input.metadata),
      ip_hash: input.ipHash?.trim() || null,
      user_agent: input.userAgent?.trim()?.slice(0, 512) || null,
    });

    if (error) {
      console.error("[product-analytics] insert failed", { eventName, message: error.message });
    }
  } catch (err) {
    console.error("[product-analytics] unexpected error", err);
  }
}

/**
 * Fire-and-forget wrapper for server actions / webhooks.
 */
export function trackProductEventSafe(input: TrackProductEventInput): void {
  void trackProductEvent(input);
}

/**
 * Insert only if no prior row exists for this profile + event (best-effort dedupe).
 */
export async function trackProductEventOnce(input: TrackProductEventInput): Promise<boolean> {
  try {
    const profileId = input.profileId?.trim();
    const eventName = String(input.eventName ?? "").trim();
    if (!profileId || !eventName) {
      await trackProductEvent(input);
      return true;
    }

    const admin = createServiceRoleClient();
    if (!admin) {
      await trackProductEvent(input);
      return true;
    }

    const { data: existing } = await admin
      .from("product_analytics_events")
      .select("id")
      .eq("profile_id", profileId)
      .eq("event_name", eventName)
      .limit(1)
      .maybeSingle();

    if (existing?.id) return false;

    await trackProductEvent(input);
    return true;
  } catch {
    return false;
  }
}

export function trackProductEventOnceSafe(input: TrackProductEventInput): void {
  void trackProductEventOnce(input);
}

/** Map billing audit events to product analytics (behavioral layer; does not replace billing logs). */
export function trackProductEventFromBillingAudit(input: {
  profileId: string;
  billingEventType: BillingAuditEventType;
  metadata?: Record<string, unknown>;
}): void {
  const meta = sanitizeProductAnalyticsMetadata(input.metadata);
  const base = { profileId: input.profileId, metadata: meta, source: "billing" as const };

  switch (input.billingEventType) {
    case "checkout_completed":
      trackProductEventOnceSafe({
        ...base,
        eventName: PRODUCT_ANALYTICS_EVENTS.subscription_started,
      });
      break;
    case "subscription_upgraded":
      trackProductEventSafe({
        ...base,
        eventName: PRODUCT_ANALYTICS_EVENTS.subscription_upgraded,
      });
      break;
    case "subscription_downgraded":
    case "downgrade_scheduled":
      trackProductEventSafe({
        ...base,
        eventName: PRODUCT_ANALYTICS_EVENTS.subscription_downgraded,
      });
      break;
    case "subscription_canceled":
      trackProductEventSafe({
        ...base,
        eventName: PRODUCT_ANALYTICS_EVENTS.subscription_canceled,
      });
      break;
    default:
      break;
  }
}
