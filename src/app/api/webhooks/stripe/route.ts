import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { processStripeBillingWebhook } from "@/lib/stripe-billing-webhook";

function isUniqueViolation(err: { code?: string; message?: string }): boolean {
  return err.code === "23505" || /duplicate key|unique constraint/i.test(err.message ?? "");
}

/** Non-sensitive structured log line (no payloads, secrets, or customer data). */
function logWebhook(level: "warn" | "error", event: string, fields: Record<string, unknown>): void {
  const line = JSON.stringify({ event, ...fields });
  if (level === "error") console.error("[stripe-webhook]", line);
  else console.warn("[stripe-webhook]", line);
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const admin = createServiceRoleClient();
  if (!admin) {
    logWebhook("error", "service_role_missing", {});
    return NextResponse.json({ error: "Supabase service role not configured." }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    logWebhook("warn", "signature_header_missing", {});
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  let webhookSecret: string;
  try {
    webhookSecret = getStripeWebhookSecret();
  } catch {
    logWebhook("error", "webhook_secret_missing", {});
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    logWebhook("error", "signature_verification_failed", {
      error_name: err instanceof Error ? err.name : "unknown",
      // Most common causes: STRIPE_WEBHOOK_SECRET from a different endpoint or test vs live mode.
      secret_mode_hint: webhookSecret.startsWith("whsec_") ? "whsec" : "unexpected_format",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid signature." },
      { status: 400 }
    );
  }

  const { error: idemErr } = await admin.from("stripe_processed_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
  });
  if (idemErr && isUniqueViolation(idemErr)) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (idemErr) {
    logWebhook("error", "idempotency_insert_failed", {
      stripe_event_id: event.id,
      stripe_event_type: event.type,
      livemode: event.livemode,
      db_code: idemErr.code ?? null,
      db_message: idemErr.message,
    });
    return NextResponse.json({ error: idemErr.message }, { status: 500 });
  }

  try {
    await processStripeBillingWebhook(event, admin, stripe);
    return NextResponse.json({ received: true });
  } catch (e) {
    logWebhook("error", "handler_failed", {
      stripe_event_id: event.id,
      stripe_event_type: event.type,
      livemode: event.livemode,
      error_name: e instanceof Error ? e.name : "unknown",
      error_message: e instanceof Error ? e.message : null,
      stripe_error_type: e instanceof Stripe.errors.StripeError ? e.type : null,
    });
    await admin.from("stripe_processed_events").delete().eq("stripe_event_id", event.id);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook handler failed." },
      { status: 500 }
    );
  }
}
