import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe, resolveAppUrl } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string };
    const token = String(body?.token ?? "").trim();
    if (!token) {
      return NextResponse.json({ error: "Missing invoice token." }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    if (!admin) {
      return NextResponse.json(
        { error: "Server is missing Supabase service role configuration." },
        { status: 500 }
      );
    }

    const { data: invoice, error } = await admin
      .from("invoices")
      .select(
        `
        id,
        job_id,
        profile_id,
        public_token,
        invoice_number,
        balance_due,
        jobs (
          customer_id,
          customers (
            email
          )
        ),
        profiles (
          stripe_connect_account_id,
          stripe_connect_charges_enabled
        )
      `
      )
      .eq("public_token", token)
      .maybeSingle();

    if (error || !invoice) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    const profile = Array.isArray(invoice.profiles) ? invoice.profiles[0] : invoice.profiles;
    const connectAccountId = profile?.stripe_connect_account_id?.trim() || "";
    const chargesEnabled = Boolean(profile?.stripe_connect_charges_enabled);
    if (!connectAccountId || !chargesEnabled) {
      return NextResponse.json({ error: "Online card payments are not enabled." }, { status: 400 });
    }

    const amountCents = Math.round(Number(invoice.balance_due ?? 0) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: "Invoice has no remaining balance." }, { status: 400 });
    }

    const job = Array.isArray(invoice.jobs) ? invoice.jobs[0] : invoice.jobs;
    const customer = Array.isArray(job?.customers) ? job?.customers[0] : job?.customers;

    const stripe = getStripe();
    const appUrl = resolveAppUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${appUrl}/invoice/${token}?payment=success`,
      cancel_url: `${appUrl}/invoice/${token}?payment=cancelled`,
      line_items: [
        {
          price_data: {
            currency: "cad",
            unit_amount: amountCents,
            product_data: {
              name: `Invoice ${invoice.invoice_number ?? String(invoice.id).slice(0, 8)}`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: customer?.email ?? undefined,
      payment_intent_data: {
        transfer_data: {
          destination: connectAccountId,
        },
      },
      metadata: {
        invoice_id: String(invoice.id),
        job_id: String(invoice.job_id),
        profile_id: String(invoice.profile_id),
        customer_id: String(job?.customer_id ?? ""),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start payment checkout." },
      { status: 500 }
    );
  }
}

