import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type BillingAuditEventType =
  | "checkout_completed"
  | "subscription_upgraded"
  | "subscription_downgraded"
  | "downgrade_scheduled"
  | "cancellation_scheduled"
  | "cancellation_resumed"
  | "subscription_canceled"
  | "payment_failed"
  | "manual_billing_refresh"
  | "webhook_sync";

function sanitizeBillingMetadata(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta || typeof meta !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    const kl = k.toLowerCase();
    if (
      kl.includes("secret") ||
      kl.includes("password") ||
      kl.includes("token") ||
      kl.includes("authorization") ||
      kl.includes("api_key")
    ) {
      continue;
    }
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeBillingMetadata(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export type InsertBillingEventLogInput = {
  profileId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeEventId?: string | null;
  eventType: BillingAuditEventType;
  oldSubscriptionStatus?: string | null;
  newSubscriptionStatus?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Append a billing audit row. Fails soft (console only) if service role is missing or insert errors.
 * Never log card numbers, secrets, or raw Stripe objects.
 */
export async function insertBillingEventLog(input: InsertBillingEventLogInput): Promise<void> {
  const admin = createServiceRoleClient();
  if (!admin) {
    console.warn("[billing-audit] SUPABASE_SERVICE_ROLE_KEY missing; skipping event log");
    return;
  }

  const { error } = await admin.from("billing_event_logs").insert({
    profile_id: input.profileId,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
    stripe_event_id: input.stripeEventId ?? null,
    event_type: input.eventType,
    old_subscription_status: input.oldSubscriptionStatus ?? null,
    new_subscription_status: input.newSubscriptionStatus ?? null,
    metadata: sanitizeBillingMetadata(input.metadata),
  });

  if (error) {
    console.error("[billing-audit] insert failed", error);
  }
}
