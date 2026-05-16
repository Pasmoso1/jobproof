import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { processStripeBillingWebhook } from "@/lib/stripe-billing-webhook";

function isUniqueViolation(err: { code?: string; message?: string }): boolean {
  return err.code === "23505" || /duplicate key|unique constraint/i.test(err.message ?? "");
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase service role not configured." }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, getStripeWebhookSecret());
  } catch (err) {
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
    return NextResponse.json({ error: idemErr.message }, { status: 500 });
  }

  try {
    await processStripeBillingWebhook(event, admin, stripe);
    return NextResponse.json({ received: true });
  } catch (e) {
    await admin.from("stripe_processed_events").delete().eq("stripe_event_id", event.id);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook handler failed." },
      { status: 500 }
    );
  }
}
