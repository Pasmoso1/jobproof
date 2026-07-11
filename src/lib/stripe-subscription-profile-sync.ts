import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";
import {
  type BillingPlanTier,
  type BillingPricingVersion,
  getPlanFromStripePriceId,
  getStripe,
} from "@/lib/stripe";
import { subscriptionCancellationDbFields } from "@/lib/stripe-subscription-cancellation";
import { profileLimitColumnsForTier } from "@/lib/plan-entitlements";
import { resolveTrialEndsAtForStripeSync } from "@/lib/trial-conversion";

export function subscriptionPeriodEndUnix(sub: Stripe.Subscription): number | null {
  const end = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return typeof end === "number" ? end : null;
}

export function unixToIso(ts?: number | null): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

export function tierFromMetadata(v: unknown): BillingPlanTier | null {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  return t === "essential" || t === "professional" ? t : null;
}

export function pricingFromMetadata(v: unknown): BillingPricingVersion | null {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  return t === "founder" || t === "standard" ? t : null;
}

function logStripeSync(context: string, err: { requestId?: string; code?: string; type?: string }) {
  console.error(`[stripe] ${context}`, {
    requestId: err.requestId ?? null,
    code: err.code ?? null,
    type: err.type ?? null,
  });
}

export type SyncStripeSubscriptionToProfileResult =
  | { ok: true; newSubscriptionStatus: string | null }
  | {
      ok: false;
      code:
        | "no_subscription_id"
        | "customer_mismatch"
        | "stripe_invalid_request"
        | "stripe_retryable"
        | "database";
      message: string;
    };

type ProfileSyncInput = Pick<
  Profile,
  | "id"
  | "user_id"
  | "stripe_customer_id"
  | "stripe_subscription_id"
  | "plan_tier"
  | "pricing_version"
  | "trial_ends_at"
>;

/**
 * Retrieves the profile’s Stripe subscription and writes billing fields to `profiles`.
 * Shared by the manual resync action and `/settings/billing` auto-sync.
 */
export async function syncStripeSubscriptionToProfile(
  supabase: SupabaseClient,
  user: { id: string },
  profile: ProfileSyncInput
): Promise<SyncStripeSubscriptionToProfileResult> {
  const subId = (profile.stripe_subscription_id ?? "").trim() || null;
  if (!subId) {
    return { ok: false, code: "no_subscription_id", message: "No stripe_subscription_id on profile." };
  }

  const customerId = (profile.stripe_customer_id ?? "").trim() || null;
  const stripe = getStripe();

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subId);
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      logStripeSync("syncStripeSubscriptionToProfile retrieve", err);
      return {
        ok: false,
        code: "stripe_invalid_request",
        message: err.message ?? "Stripe invalid request",
      };
    }
    if (err instanceof Stripe.errors.StripeError) {
      return {
        ok: false,
        code: "stripe_retryable",
        message: err.message ?? "Stripe error",
      };
    }
    throw err;
  }

  const subCustomer = String(sub.customer ?? "").trim();
  if (customerId && subCustomer !== customerId) {
    return {
      ok: false,
      code: "customer_mismatch",
      message: "Subscription customer does not match profile stripe_customer_id.",
    };
  }

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const plan = priceId ? getPlanFromStripePriceId(priceId) : null;
  const metaTier = tierFromMetadata(sub.metadata?.plan_tier);
  const metaPricing = pricingFromMetadata(sub.metadata?.pricing_version);
  const resolvedTier = plan?.planTier ?? metaTier ?? profile.plan_tier ?? null;

  const clearPendingDowngrade =
    resolvedTier === "essential"
      ? {
          pending_plan_tier: null,
          pending_plan_effective_at: null,
          stripe_subscription_schedule_id: null,
        }
      : {};

  const { error } = await supabase
    .from("profiles")
    .update({
      stripe_customer_id: subCustomer || customerId || profile.stripe_customer_id,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      plan_tier: resolvedTier,
      pricing_version: plan?.pricingVersion ?? metaPricing ?? profile.pricing_version ?? null,
      subscription_status: sub.status,
      subscription_current_period_end: unixToIso(subscriptionPeriodEndUnix(sub)),
      trial_ends_at: resolveTrialEndsAtForStripeSync(sub.trial_end ?? null, profile.trial_ends_at),
      ...profileLimitColumnsForTier(
        (resolvedTier as "essential" | "professional" | null) ?? "essential"
      ),
      ...subscriptionCancellationDbFields(sub),
      ...clearPendingDowngrade,
    })
    .eq("id", profile.id)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, code: "database", message: error.message };
  }
  return { ok: true, newSubscriptionStatus: sub.status };
}

/**
 * Statuses that can change in the Billing Portal or stay stale until a webhook arrives.
 * Aligns with `profiles.subscription_status` CHECK constraint values.
 */
const AUTO_SYNC_ON_BILLING_LOAD_STATUSES = new Set([
  "trial",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "cancelled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
]);

/**
 * Whether `/settings/billing` should pull subscription state from Stripe once per load.
 * Requires a linked subscription id and a lifecycle status where portal / webhooks may desync Supabase.
 */
export function shouldAutoSyncStripeSubscriptionOnBillingLoad(profile: {
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
}): boolean {
  const subId = (profile.stripe_subscription_id ?? "").trim();
  if (!subId) return false;
  const status = (profile.subscription_status ?? "").trim().toLowerCase();
  if (!status) return true;
  return AUTO_SYNC_ON_BILLING_LOAD_STATUSES.has(status);
}
