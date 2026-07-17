import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { insertBillingEventLog } from "@/lib/billing-audit-log";
import { parseBillingPlanTier } from "@/lib/billing-plan-display";
import {
  computePaymentDerivedState,
  resolvePaidAtAfterRecalc,
  roundInvoiceMoney,
} from "@/lib/invoice-payment-recalc";
import { getTodayYmdEastern } from "@/lib/datetime-eastern";
import { getPlanFromStripePriceId } from "@/lib/stripe";
import { subscriptionCancellationDbFields } from "@/lib/stripe-subscription-cancellation";
import { tierFromMetadata } from "@/lib/stripe-subscription-profile-sync";
import { profileLimitColumnsForTier } from "@/lib/plan-entitlements";
import {
  resolveTrialEndsAtForStripeSync,
  trackTrialConversionAnalytics,
} from "@/lib/trial-conversion";

function limitColumnsForPlanTier(tier: string | null | undefined) {
  const parsed = parseBillingPlanTier(String(tier ?? ""));
  return profileLimitColumnsForTier(parsed ?? "essential");
}

function toIso(ts?: number | null): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

function subscriptionCurrentPeriodEndUnixFromBasilWebhook(sub: Stripe.Subscription): number | null {
  const end = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return typeof end === "number" ? end : null;
}

function subscriptionIdFromBasilInvoice(inv: Stripe.Invoice): string {
  const root = (inv as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
  if (root == null) return "";
  return typeof root === "string" ? root : root.id;
}

async function findProfileByCustomerOrMetadata(input: {
  admin: SupabaseClient;
  customerId?: string | null;
  profileId?: string | null;
}) {
  const admin = input.admin;
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

function resolvePlanTierFromStripeSub(
  sub: Stripe.Subscription,
  priceId: string | null
): ReturnType<typeof parseBillingPlanTier> {
  const fromPrice = priceId ? getPlanFromStripePriceId(priceId)?.planTier : null;
  if (fromPrice) return fromPrice;
  return tierFromMetadata(sub.metadata?.plan_tier);
}

function classifySubscriptionChange(input: {
  profile: Record<string, unknown>;
  sub: Stripe.Subscription;
}): {
  eventType:
    | "cancellation_scheduled"
    | "cancellation_resumed"
    | "subscription_upgraded"
    | "subscription_downgraded"
    | "webhook_sync";
  metadata: Record<string, unknown>;
} {
  const { profile, sub } = input;
  const oldCancelEnd = profile.subscription_cancel_at_period_end === true;
  const newCancelEnd = Boolean(sub.cancel_at_period_end);
  if (!oldCancelEnd && newCancelEnd) {
    return { eventType: "cancellation_scheduled", metadata: { source: "stripe_subscription" } };
  }
  if (oldCancelEnd && !newCancelEnd) {
    return { eventType: "cancellation_resumed", metadata: { source: "stripe_subscription" } };
  }

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const oldTier = parseBillingPlanTier(String(profile.plan_tier ?? ""));
  const newTier = resolvePlanTierFromStripeSub(sub, priceId);
  if (oldTier === "essential" && newTier === "professional") {
    return {
      eventType: "subscription_upgraded",
      metadata: { from_plan_tier: oldTier, to_plan_tier: newTier, source: "stripe_subscription" },
    };
  }
  if (oldTier === "professional" && newTier === "essential") {
    return {
      eventType: "subscription_downgraded",
      metadata: { from_plan_tier: oldTier, to_plan_tier: newTier, source: "stripe_subscription" },
    };
  }

  return {
    eventType: "webhook_sync",
    metadata: {
      stripe_subscription_id: sub.id,
      cancel_at_period_end: sub.cancel_at_period_end,
      status_transition: {
        from: String(profile.subscription_status ?? ""),
        to: sub.status,
      },
    },
  };
}

export async function processStripeBillingWebhook(
  event: Stripe.Event,
  admin: SupabaseClient,
  stripe: Stripe
): Promise<void> {
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
          const oldStatus = String(profile.subscription_status ?? "");
          let sub: Stripe.Subscription | null = null;
          if (subId) {
            sub = await stripe.subscriptions.retrieve(subId);
          }
          const priceId = sub?.items.data[0]?.price?.id ?? session.metadata?.price_id ?? null;
          const plan = priceId ? getPlanFromStripePriceId(priceId) : null;
          const cancelPatch = sub ? subscriptionCancellationDbFields(sub) : null;
          const newStatus = sub?.status ?? String(profile.subscription_status ?? "");
          const resolvedTier =
            plan?.planTier ?? session.metadata?.plan_tier ?? profile.plan_tier;
          await admin
            .from("profiles")
            .update({
              stripe_customer_id: customerId || profile.stripe_customer_id,
              stripe_subscription_id: subId || profile.stripe_subscription_id,
              stripe_price_id: priceId,
              plan_tier: resolvedTier,
              pricing_version:
                plan?.pricingVersion ??
                session.metadata?.pricing_version ??
                profile.pricing_version,
              subscription_status: newStatus,
              subscription_current_period_end: toIso(
                sub ? subscriptionCurrentPeriodEndUnixFromBasilWebhook(sub) : null
              ),
              trial_ends_at: resolveTrialEndsAtForStripeSync(
                sub?.trial_end,
                profile.trial_ends_at as string | null | undefined
              ),
              ...limitColumnsForPlanTier(resolvedTier),
              ...(cancelPatch ?? {}),
            })
            .eq("id", profile.id);
          trackTrialConversionAnalytics({
            profile: {
              id: String(profile.id),
              subscription_status: oldStatus,
              trial_started_at: profile.trial_started_at as string | null | undefined,
              trial_ends_at: profile.trial_ends_at as string | null | undefined,
              trial_plan_tier: profile.trial_plan_tier as string | null | undefined,
              plan_tier: profile.plan_tier as string | null | undefined,
            },
            previousStatus: oldStatus,
            newStatus,
            subscribedPlan: resolvedTier,
            source: "stripe_checkout_webhook",
          });
          await insertBillingEventLog({
            profileId: String(profile.id),
            stripeCustomerId: customerId || null,
            stripeSubscriptionId: subId || null,
            stripeEventId: event.id,
            eventType: "checkout_completed",
            oldSubscriptionStatus: oldStatus,
            newSubscriptionStatus: newStatus,
            metadata: {
              plan_tier: plan?.planTier ?? session.metadata?.plan_tier,
              pricing_version: plan?.pricingVersion ?? session.metadata?.pricing_version,
            },
          });

          if (["active", "trialing", "past_due"].includes(String(newStatus))) {
            try {
              const { markPartnerReferralSubscriptionStarted } = await import(
                "@/lib/partners/attribution"
              );
              await markPartnerReferralSubscriptionStarted(admin, String(profile.id));
            } catch (err) {
              console.error("[stripe-webhook] partner subscription started", err);
            }
          }
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
        const cancelPatch = subscriptionCancellationDbFields(sub);
        const oldStatus = String(profile.subscription_status ?? "");
        const classification = classifySubscriptionChange({ profile, sub });
        const resolvedTier =
          plan?.planTier ?? sub.metadata?.plan_tier ?? profile.plan_tier;
        await admin
          .from("profiles")
          .update({
            stripe_customer_id: customerId || profile.stripe_customer_id,
            stripe_subscription_id: sub.id,
            stripe_price_id: priceId,
            plan_tier: resolvedTier,
            pricing_version:
              plan?.pricingVersion ?? sub.metadata?.pricing_version ?? profile.pricing_version,
            subscription_status: sub.status,
            subscription_current_period_end: toIso(subscriptionCurrentPeriodEndUnixFromBasilWebhook(sub)),
            trial_ends_at: resolveTrialEndsAtForStripeSync(
              sub.trial_end,
              profile.trial_ends_at as string | null | undefined
            ),
            ...limitColumnsForPlanTier(resolvedTier),
            ...cancelPatch,
          })
          .eq("id", profile.id);

        if (
          event.type === "customer.subscription.created" &&
          ["pending_trial", "trial", "expired"].includes(oldStatus.toLowerCase())
        ) {
          trackTrialConversionAnalytics({
            profile: {
              id: String(profile.id),
              subscription_status: oldStatus,
              trial_started_at: profile.trial_started_at as string | null | undefined,
              trial_ends_at: profile.trial_ends_at as string | null | undefined,
              trial_plan_tier: profile.trial_plan_tier as string | null | undefined,
              plan_tier: profile.plan_tier as string | null | undefined,
            },
            previousStatus: oldStatus,
            newStatus: sub.status,
            subscribedPlan: resolvedTier,
            source: "stripe_subscription_created",
          });
        }

        await insertBillingEventLog({
          profileId: String(profile.id),
          stripeCustomerId: customerId || null,
          stripeSubscriptionId: sub.id,
          stripeEventId: event.id,
          eventType: classification.eventType,
          oldSubscriptionStatus: oldStatus,
          newSubscriptionStatus: sub.status,
          metadata: { ...classification.metadata, stripe_event_type: event.type },
        });
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
        const oldStatus = String(profile.subscription_status ?? "");
        await admin
          .from("profiles")
          .update({
            subscription_status: "canceled",
            subscription_current_period_end: toIso(
              subscriptionCurrentPeriodEndUnixFromBasilWebhook(sub)
            ),
            subscription_cancel_at_period_end: false,
            subscription_cancel_at: null,
            subscription_canceled_at: toIso(sub.canceled_at ?? null),
            stripe_subscription_id: sub.id,
          })
          .eq("id", profile.id);
        await insertBillingEventLog({
          profileId: String(profile.id),
          stripeCustomerId: String(sub.customer ?? "") || null,
          stripeSubscriptionId: sub.id,
          stripeEventId: event.id,
          eventType: "subscription_canceled",
          oldSubscriptionStatus: oldStatus,
          newSubscriptionStatus: "canceled",
          metadata: { stripe_event_type: event.type },
        });
      }
      break;
    }

    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      const subscriptionId = subscriptionIdFromBasilInvoice(inv);
      if (subscriptionId) {
        const { data: profile } = await admin
          .from("profiles")
          .select("id, stripe_customer_id, subscription_status")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();
        const prevStatus = profile ? String(profile.subscription_status ?? "") : "";
        await admin
          .from("profiles")
          .update({
            subscription_status: "active",
            grace_period_ends_at: null,
          })
          .eq("stripe_subscription_id", subscriptionId);
        if (profile) {
          await insertBillingEventLog({
            profileId: String(profile.id),
            stripeCustomerId: profile.stripe_customer_id ?? null,
            stripeSubscriptionId: subscriptionId,
            stripeEventId: event.id,
            eventType: "webhook_sync",
            oldSubscriptionStatus: prevStatus,
            newSubscriptionStatus: "active",
            metadata: {
              kind: "invoice_paid",
              invoice_id: inv.id,
              // Tax ledger stays in Stripe; log amounts for support only.
              currency: inv.currency ?? null,
              subtotal:
                typeof inv.subtotal === "number" ? inv.subtotal / 100 : null,
              tax: (() => {
                const totalTaxes = (
                  inv as {
                    total_taxes?: Array<{ amount?: number | null }> | null;
                  }
                ).total_taxes;
                if (Array.isArray(totalTaxes) && totalTaxes.length > 0) {
                  const sum = totalTaxes.reduce(
                    (acc, row) => acc + (typeof row.amount === "number" ? row.amount : 0),
                    0
                  );
                  return sum / 100;
                }
                return null;
              })(),
              total: typeof inv.total === "number" ? inv.total / 100 : null,
              automatic_tax_status: inv.automatic_tax?.status ?? null,
              customer_address_country: inv.customer_address?.country ?? null,
              customer_address_state: inv.customer_address?.state ?? null,
            },
          });
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const subscriptionId = subscriptionIdFromBasilInvoice(inv);
      if (subscriptionId) {
        const { data: profile } = await admin
          .from("profiles")
          .select("id, grace_period_ends_at, stripe_customer_id, subscription_status")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();
        if (profile) {
          const oldStatus = String(profile.subscription_status ?? "");
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
          await insertBillingEventLog({
            profileId: String(profile.id),
            stripeCustomerId: profile.stripe_customer_id ?? null,
            stripeSubscriptionId: subscriptionId,
            stripeEventId: event.id,
            eventType: "payment_failed",
            oldSubscriptionStatus: oldStatus,
            newSubscriptionStatus: "past_due",
            metadata: {
              invoice_id: inv.id,
              attempt_count: inv.attempt_count ?? null,
            },
          });
        }
      }
      break;
    }

    case "customer.subscription.trial_will_end":
      break;

    case "invoice.finalized":
      /* Acknowledged for live/test parity; no profile mutation required today. */
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
}
