import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getPlanFromStripePriceId,
  getStripe,
  getStripeWebhookSecret,
} from "@/lib/stripe";
import {
  computePaymentDerivedState,
  resolvePaidAtAfterRecalc,
  roundInvoiceMoney,
} from "@/lib/invoice-payment-recalc";
import { getTodayYmdEastern } from "@/lib/datetime-eastern";

function toIso(ts?: number | null): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

async function findProfileByCustomerOrMetadata(input: {
  admin: ReturnType<typeof createServiceRoleClient>;
  customerId?: string | null;
  profileId?: string | null;
}) {
  const admin = input.admin;
  if (!admin) return null;
  if (input.profileId) {
    const { data } = await admin.from("profiles").select("*").eq("id", input.profileId).maybeSingle();
    if (data) return data;
  }
  if (input.customerId) {
    const { data } = await admin
      .from("profiles")
      .select("*")
      .eq("stripe_customer_id", input.customerId)
      .maybeSingle();
    if (data) return data;
  }
  return null;
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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          const subId = String(session.subscription ?? "");
          const customerId = String(session.customer ?? "");
          const profile = await findProfileByCustomerOrMetadata({
            admin,
            customerId,
            profileId: String(session.metadata?.profile_id ?? ""),
          });
          if (profile) {
            let sub: Stripe.Subscription | null = null;
            if (subId) {
              sub = await stripe.subscriptions.retrieve(subId);
            }
            const priceId = sub?.items.data[0]?.price?.id ?? session.metadata?.price_id ?? null;
            const plan = priceId ? getPlanFromStripePriceId(priceId) : null;
            await admin
              .from("profiles")
              .update({
                stripe_customer_id: customerId || profile.stripe_customer_id,
                stripe_subscription_id: subId || profile.stripe_subscription_id,
                stripe_price_id: priceId,
                plan_tier: plan?.planTier ?? session.metadata?.plan_tier ?? profile.plan_tier,
                pricing_version:
                  plan?.pricingVersion ??
                  session.metadata?.pricing_version ??
                  profile.pricing_version,
                subscription_status: sub?.status ?? profile.subscription_status,
                subscription_current_period_end: toIso(sub?.current_period_end),
                trial_ends_at: toIso(sub?.trial_end),
              })
              .eq("id", profile.id);
          }
        } else if (session.mode === "payment") {
          const invoiceId = String(session.metadata?.invoice_id ?? "");
          if (invoiceId && session.payment_status === "paid") {
            const paymentIntentId = String(session.payment_intent ?? "");
            const dedupeToken = paymentIntentId || session.id;

            const { data: existing } = await admin
              .from("invoice_payments")
              .select("id")
              .eq("invoice_id", invoiceId)
              .ilike("note", `%${dedupeToken}%`)
              .limit(1)
              .maybeSingle();

            if (!existing) {
              const { data: inv } = await admin
                .from("invoices")
                .select("id, profile_id, total, deposit_credited, due_date, sent_at, status, paid_at")
                .eq("id", invoiceId)
                .maybeSingle();
              if (inv) {
                const amount = roundInvoiceMoney((session.amount_total ?? 0) / 100);
                await admin.from("invoice_payments").insert({
                  invoice_id: inv.id,
                  profile_id: inv.profile_id,
                  amount,
                  payment_method: "card",
                  paid_on: getTodayYmdEastern(),
                  note: `Stripe online payment (${dedupeToken})`,
                });

                const { data: rows } = await admin
                  .from("invoice_payments")
                  .select("amount, created_at")
                  .eq("invoice_id", inv.id);
                const paidSum = roundInvoiceMoney(
                  (rows ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
                );
                const derived = computePaymentDerivedState({
                  total: Number(inv.total),
                  depositCredited: Number(inv.deposit_credited ?? 0),
                  paymentSum: paidSum,
                  dueDateYmd: inv.due_date,
                  sentAt: inv.sent_at,
                });
                const lastPaymentAt = rows?.reduce<string | null>((max, r) => {
                  const c = (r.created_at as string | null) ?? null;
                  if (!c) return max;
                  if (!max) return c;
                  return c > max ? c : max;
                }, null);
                await admin
                  .from("invoices")
                  .update({
                    amount_paid_total: derived.amount_paid_total,
                    balance_due: derived.balance_due,
                    status: derived.status,
                    last_payment_at: lastPaymentAt,
                    paid_at: resolvePaidAtAfterRecalc({
                      previousStatus: String(inv.status ?? ""),
                      newStatus: derived.status,
                      previousPaidAt: inv.paid_at,
                    }),
                  })
                  .eq("id", inv.id);
              }
            }
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = String(sub.customer ?? "");
        const profile = await findProfileByCustomerOrMetadata({
          admin,
          customerId,
          profileId: String(sub.metadata?.profile_id ?? ""),
        });
        if (profile) {
          const priceId = sub.items.data[0]?.price?.id ?? null;
          const plan = priceId ? getPlanFromStripePriceId(priceId) : null;
          await admin
            .from("profiles")
            .update({
              stripe_customer_id: customerId || profile.stripe_customer_id,
              stripe_subscription_id: sub.id,
              stripe_price_id: priceId,
              plan_tier: plan?.planTier ?? sub.metadata?.plan_tier ?? profile.plan_tier,
              pricing_version:
                plan?.pricingVersion ??
                sub.metadata?.pricing_version ??
                profile.pricing_version,
              subscription_status: sub.status,
              subscription_current_period_end: toIso(sub.current_period_end),
              trial_ends_at: toIso(sub.trial_end),
            })
            .eq("id", profile.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const profile = await findProfileByCustomerOrMetadata({
          admin,
          customerId: String(sub.customer ?? ""),
          profileId: String(sub.metadata?.profile_id ?? ""),
        });
        if (profile) {
          await admin
            .from("profiles")
            .update({
              subscription_status: "canceled",
              subscription_current_period_end: toIso(sub.current_period_end),
            })
            .eq("id", profile.id);
        }
        break;
      }

      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const subscriptionId = String(inv.subscription ?? "");
        if (subscriptionId) {
          await admin
            .from("profiles")
            .update({
              subscription_status: "active",
              grace_period_ends_at: null,
            })
            .eq("stripe_subscription_id", subscriptionId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subscriptionId = String(inv.subscription ?? "");
        if (subscriptionId) {
          const { data: profile } = await admin
            .from("profiles")
            .select("id, grace_period_ends_at")
            .eq("stripe_subscription_id", subscriptionId)
            .maybeSingle();
          if (profile) {
            const grace =
              profile.grace_period_ends_at ??
              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            await admin
              .from("profiles")
              .update({
                subscription_status: "past_due",
                grace_period_ends_at: grace,
              })
              .eq("id", profile.id);
          }
        }
        break;
      }

      case "customer.subscription.trial_will_end":
        break;

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        let profileId = String(account.metadata?.profile_id ?? "");
        if (!profileId) {
          const { data: profile } = await admin
            .from("profiles")
            .select("id")
            .eq("stripe_connect_account_id", account.id)
            .maybeSingle();
          profileId = String(profile?.id ?? "");
        }
        if (profileId) {
          await admin
            .from("profiles")
            .update({
              stripe_connect_account_id: account.id,
              stripe_connect_charges_enabled: account.charges_enabled,
              stripe_connect_payouts_enabled: account.payouts_enabled,
              stripe_connect_details_submitted: account.details_submitted,
              stripe_connect_onboarding_complete:
                (account.charges_enabled && account.payouts_enabled) || account.details_submitted,
            })
            .eq("id", profileId);
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook handler failed." },
      { status: 500 }
    );
  }
}

