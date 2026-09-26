import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";
import {
  type BillingPlanTier,
  type BillingPricingVersion,
  getPlanFromStripePriceId,
  getStripe,
} from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  linkStripeSubscriptionForProfile,
  type LinkSource,
  type LinkStripeSubscriptionResult,
  type StripeBillingApi,
} from "@/lib/stripe-subscription-link";

export { subscriptionPeriodEndUnix, unixToIso } from "@/lib/stripe-subscription-link";

export function tierFromMetadata(v: unknown): BillingPlanTier | null {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  return t === "essential" || t === "professional" ? t : null;
}

export function pricingFromMetadata(v: unknown): BillingPricingVersion | null {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  return t === "founder" || t === "standard" ? t : null;
}

/**
 * Trusted client for billing writes. Ownership is established from the authenticated
 * session before this is used; every write is scoped to that profile id + user id.
 */
export function billingWriteClient(userClient: SupabaseClient): SupabaseClient {
  return (createServiceRoleClient() as SupabaseClient | null) ?? userClient;
}

export type SyncStripeSubscriptionToProfileResult =
  | { ok: true; newSubscriptionStatus: string | null }
  | {
      ok: false;
      code:
        | "no_subscription_id"
        | "no_stripe_customer"
        | "customer_mismatch"
        | "ambiguous_subscriptions"
        | "pending"
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
> & { subscription_status?: string | null };

function toSyncResult(result: LinkStripeSubscriptionResult): SyncStripeSubscriptionToProfileResult {
  if (result.ok) return { ok: true, newSubscriptionStatus: result.subscriptionStatus };
  switch (result.reason) {
    case "missing_stripe_customer":
      return { ok: false, code: "no_stripe_customer", message: result.reason };
    case "no_subscription_found":
      return { ok: false, code: "no_subscription_id", message: result.reason };
    case "ambiguous_subscriptions":
      return { ok: false, code: "ambiguous_subscriptions", message: result.reason };
    case "subscription_not_active_yet":
    case "checkout_not_complete":
      return { ok: false, code: "pending", message: result.reason };
    case "subscription_customer_mismatch":
    case "subscription_profile_mismatch":
    case "checkout_customer_mismatch":
    case "checkout_profile_mismatch":
      return { ok: false, code: "customer_mismatch", message: result.reason };
    case "subscription_price_unrecognized":
      return { ok: false, code: "stripe_invalid_request", message: result.reason };
    case "database_error":
    case "profile_not_updated":
      return { ok: false, code: "database", message: result.reason };
    default:
      return { ok: false, code: "stripe_retryable", message: result.reason };
  }
}

/** Link/refresh the profile's Stripe subscription from Stripe (server-side only). */
export async function linkProfileStripeSubscription(input: {
  supabase: SupabaseClient;
  user: { id: string };
  profile: ProfileSyncInput;
  source: LinkSource;
  checkoutSessionId?: string | null;
}): Promise<LinkStripeSubscriptionResult> {
  return linkStripeSubscriptionForProfile({
    stripe: getStripe() as unknown as StripeBillingApi,
    db: billingWriteClient(input.supabase),
    profile: {
      id: String(input.profile.id),
      user_id: input.profile.user_id,
      stripe_customer_id: input.profile.stripe_customer_id,
      stripe_subscription_id: input.profile.stripe_subscription_id,
      plan_tier: input.profile.plan_tier,
      pricing_version: input.profile.pricing_version,
      trial_ends_at: input.profile.trial_ends_at,
      subscription_status: input.profile.subscription_status ?? null,
    },
    userId: input.user.id,
    planFromPriceId: getPlanFromStripePriceId,
    source: input.source,
    checkoutSessionId: input.checkoutSessionId ?? null,
    clearPendingDowngradeWhenEssential: true,
  });
}

/**
 * Pulls the profile's Stripe subscription into `profiles`. Uses the linked
 * subscription id when present; otherwise recovers the single current JobProof
 * subscription for the profile's own Stripe customer.
 * Shared by the manual resync action and `/settings/billing` auto-sync.
 */
export async function syncStripeSubscriptionToProfile(
  supabase: SupabaseClient,
  user: { id: string },
  profile: ProfileSyncInput,
  source: LinkSource = "refresh"
): Promise<SyncStripeSubscriptionToProfileResult> {
  const result = await linkProfileStripeSubscription({ supabase, user, profile, source });
  return toSyncResult(result);
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

/** Managed-trial states where a missed webhook could leave a paid subscription unlinked. */
const CUSTOMER_RECOVERY_ON_BILLING_LOAD_STATUSES = new Set(["", "pending_trial", "trial", "expired"]);

/**
 * Whether `/settings/billing` should pull subscription state from Stripe once per load:
 * - a linked subscription in a lifecycle status where portal / webhooks may desync Supabase, or
 * - a Stripe customer without a linked subscription (customer-based recovery).
 */
export function shouldAutoSyncStripeSubscriptionOnBillingLoad(profile: {
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  subscription_status?: string | null;
  beta_tester?: boolean | null;
}): boolean {
  const subId = (profile.stripe_subscription_id ?? "").trim();
  const status = (profile.subscription_status ?? "").trim().toLowerCase();
  if (!subId) {
    if (profile.beta_tester === true) return false;
    if (!(profile.stripe_customer_id ?? "").trim()) return false;
    return CUSTOMER_RECOVERY_ON_BILLING_LOAD_STATUSES.has(status);
  }
  if (!status) return true;
  return AUTO_SYNC_ON_BILLING_LOAD_STATUSES.has(status);
}