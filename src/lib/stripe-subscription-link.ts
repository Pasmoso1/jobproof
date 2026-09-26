/**
 * Links a verified Stripe subscription to a JobProof profile.
 *
 * Shared by the Checkout return sync, Billing "Refresh billing status", and the
 * Billing page-load sync. Stripe and the database client are injected so the
 * ownership / recovery rules can be unit tested without network access.
 *
 * Stripe API version: 2025-05-28.basil (period end lives on subscription items;
 * invoice → subscription lives under invoice.parent.subscription_details).
 */

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingPlanTier, BillingPricingVersion } from "@/lib/stripe";
import { parseBillingPlanTier, parseBillingPricingVersion } from "@/lib/billing-plan-display";
import { profileLimitColumnsForTier } from "@/lib/plan-entitlements";
import { subscriptionCancellationDbFields } from "@/lib/stripe-subscription-cancellation";
import { resolveTrialEndsAtForStripeSync } from "@/lib/trial-conversion";

// ---------------------------------------------------------------------------
// Stripe object helpers (Basil-compatible, defensive about string | object)
// ---------------------------------------------------------------------------

/** Normalize a Stripe expandable field (`"sub_123"` or `{ id: "sub_123" }`) to its id. */
export function stripeObjectId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const id = value.trim();
    return id || null;
  }
  if (typeof value === "object" && "id" in value) {
    const id = String((value as { id?: unknown }).id ?? "").trim();
    return id || null;
  }
  return null;
}

function positiveUnix(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Current billing-period end (unix seconds) for a subscription.
 * Basil moved `current_period_end` onto subscription items; with several items the
 * earliest end is the next billing date. Falls back to the legacy root field.
 * Returns null rather than inventing a date.
 */
export function subscriptionPeriodEndUnix(sub: Stripe.Subscription | null | undefined): number | null {
  if (!sub) return null;
  const items = (sub as { items?: { data?: unknown[] } }).items?.data;
  const itemEnds: number[] = [];
  if (Array.isArray(items)) {
    for (const item of items) {
      const end = positiveUnix((item as { current_period_end?: unknown } | null)?.current_period_end);
      if (end != null) itemEnds.push(end);
    }
  }
  if (itemEnds.length > 0) return Math.min(...itemEnds);
  return positiveUnix((sub as { current_period_end?: unknown }).current_period_end);
}

export function unixToIso(ts?: number | null): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

/**
 * Subscription id for an invoice. Basil: `invoice.parent.subscription_details.subscription`.
 * Falls back to the legacy root `invoice.subscription`, then to line-item parents.
 */
export function invoiceSubscriptionId(invoice: Stripe.Invoice | null | undefined): string | null {
  if (!invoice) return null;
  const parent = (invoice as {
    parent?: { subscription_details?: { subscription?: unknown } | null } | null;
  }).parent;
  const fromParent = stripeObjectId(parent?.subscription_details?.subscription);
  if (fromParent) return fromParent;

  const legacy = stripeObjectId((invoice as { subscription?: unknown }).subscription);
  if (legacy) return legacy;

  const lines = (invoice as { lines?: { data?: unknown[] } }).lines?.data;
  if (Array.isArray(lines)) {
    for (const line of lines) {
      const lineParent = (line as {
        parent?: {
          subscription_item_details?: { subscription?: unknown } | null;
        } | null;
        subscription?: unknown;
      } | null);
      const id =
        stripeObjectId(lineParent?.parent?.subscription_item_details?.subscription) ??
        stripeObjectId(lineParent?.subscription);
      if (id) return id;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ownership / eligibility rules
// ---------------------------------------------------------------------------

/** Statuses that represent a paid (or payable) JobProof subscription worth linking. */
export const LINKABLE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

export type PlanFromPriceId = (
  priceId: string
) => { planTier: BillingPlanTier; pricingVersion: BillingPricingVersion } | null;

function subscriptionPlan(
  sub: Stripe.Subscription,
  planFromPriceId: PlanFromPriceId
): { priceId: string; planTier: BillingPlanTier; pricingVersion: BillingPricingVersion } | null {
  const items = sub.items?.data ?? [];
  for (const item of items) {
    const priceId = stripeObjectId(item?.price);
    if (!priceId) continue;
    const plan = planFromPriceId(priceId);
    if (plan) return { priceId, ...plan };
  }
  return null;
}

export type OwnershipContext = {
  customerId: string;
  profileId: string;
  planFromPriceId: PlanFromPriceId;
};

export type CheckoutSessionCheck =
  | { ok: true; subscriptionId: string; expandedSubscription: Stripe.Subscription | null }
  | {
      ok: false;
      reason:
        | "not_subscription_checkout"
        | "checkout_not_complete"
        | "checkout_customer_mismatch"
        | "checkout_profile_mismatch"
        | "checkout_subscription_missing";
    };

/** Validates a server-retrieved Checkout session against the authenticated profile. */
export function validateCheckoutSessionOwnership(
  session: Stripe.Checkout.Session,
  ctx: Pick<OwnershipContext, "customerId" | "profileId">
): CheckoutSessionCheck {
  if (session.mode !== "subscription") return { ok: false, reason: "not_subscription_checkout" };
  if (stripeObjectId(session.customer) !== ctx.customerId) {
    return { ok: false, reason: "checkout_customer_mismatch" };
  }
  if (String(session.metadata?.profile_id ?? "").trim() !== ctx.profileId) {
    return { ok: false, reason: "checkout_profile_mismatch" };
  }
  if (session.status !== "complete") return { ok: false, reason: "checkout_not_complete" };
  const subscriptionId = stripeObjectId(session.subscription);
  if (!subscriptionId) return { ok: false, reason: "checkout_subscription_missing" };
  const expanded =
    session.subscription && typeof session.subscription === "object"
      ? (session.subscription as Stripe.Subscription)
      : null;
  return { ok: true, subscriptionId, expandedSubscription: expanded };
}

export type SubscriptionCheck =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "subscription_customer_mismatch"
        | "subscription_profile_mismatch"
        | "subscription_price_unrecognized"
        | "subscription_not_active_yet";
    };

/**
 * A subscription may be linked only when it belongs to this exact Stripe customer,
 * is not tagged for a different profile, uses a JobProof price, and is paid/payable.
 */
export function validateSubscriptionForProfile(
  sub: Stripe.Subscription,
  ctx: OwnershipContext,
  options?: { requireLinkableStatus?: boolean; requireJobProofPrice?: boolean }
): SubscriptionCheck {
  if (stripeObjectId(sub.customer) !== ctx.customerId) {
    return { ok: false, reason: "subscription_customer_mismatch" };
  }
  const metaProfile = String(sub.metadata?.profile_id ?? "").trim();
  if (metaProfile && metaProfile !== ctx.profileId) {
    return { ok: false, reason: "subscription_profile_mismatch" };
  }
  if (options?.requireJobProofPrice !== false && !subscriptionPlan(sub, ctx.planFromPriceId)) {
    return { ok: false, reason: "subscription_price_unrecognized" };
  }
  if (options?.requireLinkableStatus !== false && !LINKABLE_SUBSCRIPTION_STATUSES.has(sub.status)) {
    return { ok: false, reason: "subscription_not_active_yet" };
  }
  return { ok: true };
}

export type RecoverySelection =
  | { ok: true; subscription: Stripe.Subscription }
  | { ok: false; reason: "no_subscription_found" | "ambiguous_subscriptions"; candidateCount: number };

/**
 * Customer-based recovery: pick the single current JobProof subscription for this
 * customer. Rejects unrelated subscriptions and refuses to guess between several.
 */
export function selectRecoverableSubscription(
  subscriptions: Stripe.Subscription[],
  ctx: OwnershipContext
): RecoverySelection {
  const candidates = subscriptions.filter(
    (sub) => validateSubscriptionForProfile(sub, ctx).ok
  );
  if (candidates.length === 1) return { ok: true, subscription: candidates[0] };
  if (candidates.length === 0) {
    return { ok: false, reason: "no_subscription_found", candidateCount: 0 };
  }
  return { ok: false, reason: "ambiguous_subscriptions", candidateCount: candidates.length };
}

// ---------------------------------------------------------------------------
// Profile patch + checked write
// ---------------------------------------------------------------------------

export type LinkProfileFields = {
  id: string;
  user_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plan_tier?: string | null;
  pricing_version?: string | null;
  trial_ends_at?: string | null;
  subscription_status?: string | null;
};

export function buildProfileSubscriptionPatch(
  sub: Stripe.Subscription,
  profile: LinkProfileFields,
  planFromPriceId: PlanFromPriceId,
  options?: { clearPendingDowngradeWhenEssential?: boolean }
): Record<string, unknown> {
  const plan = subscriptionPlan(sub, planFromPriceId);
  const firstPriceId = stripeObjectId(sub.items?.data?.[0]?.price);
  const resolvedTier: BillingPlanTier | null =
    plan?.planTier ??
    parseBillingPlanTier(String(sub.metadata?.plan_tier ?? "")) ??
    parseBillingPlanTier(String(profile.plan_tier ?? ""));
  const resolvedPricing: BillingPricingVersion | null =
    plan?.pricingVersion ??
    parseBillingPricingVersion(String(sub.metadata?.pricing_version ?? "")) ??
    parseBillingPricingVersion(String(profile.pricing_version ?? ""));

  const patch: Record<string, unknown> = {
    stripe_customer_id: stripeObjectId(sub.customer) ?? profile.stripe_customer_id ?? null,
    stripe_subscription_id: sub.id,
    stripe_price_id: plan?.priceId ?? firstPriceId,
    plan_tier: resolvedTier,
    pricing_version: resolvedPricing,
    subscription_status: sub.status,
    subscription_current_period_end: unixToIso(subscriptionPeriodEndUnix(sub)),
    trial_ends_at: resolveTrialEndsAtForStripeSync(sub.trial_end ?? null, profile.trial_ends_at),
    ...profileLimitColumnsForTier(resolvedTier ?? "essential"),
    ...subscriptionCancellationDbFields(sub),
  };
  if (options?.clearPendingDowngradeWhenEssential && resolvedTier === "essential") {
    patch.pending_plan_tier = null;
    patch.pending_plan_effective_at = null;
    patch.stripe_subscription_schedule_id = null;
  }
  return patch;
}

export type ProfileWriteResult =
  | { ok: true }
  | { ok: false; reason: "database_error" | "profile_not_updated"; message: string };

/** Update exactly one profile row and surface database errors instead of ignoring them. */
export async function writeProfileSubscriptionPatch(
  db: SupabaseClient,
  input: { profileId: string; userId?: string | null; patch: Record<string, unknown> }
): Promise<ProfileWriteResult> {
  let query = db.from("profiles").update(input.patch).eq("id", input.profileId);
  if (input.userId) query = query.eq("user_id", input.userId);
  const { data, error } = await query.select("id");
  if (error) return { ok: false, reason: "database_error", message: error.message };
  const rows = Array.isArray(data) ? data.length : 0;
  if (rows !== 1) {
    return { ok: false, reason: "profile_not_updated", message: `updated_rows=${rows}` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Non-sensitive logging
// ---------------------------------------------------------------------------

/** Last characters of a Stripe id — enough to correlate in the Dashboard, not the full id. */
export function stripeIdSuffix(id: string | null | undefined): string | null {
  const v = String(id ?? "").trim();
  if (!v) return null;
  return `…${v.slice(-8)}`;
}

export type BillingSyncLogFields = {
  source: string;
  profile_id?: string | null;
  reason?: string;
  customer?: string | null;
  subscription?: string | null;
  checkout_session?: string | null;
  subscription_status?: string | null;
  candidate_count?: number;
  stripe_error_type?: string | null;
  stripe_error_code?: string | null;
  db_message?: string | null;
};

export function logBillingSync(
  level: "info" | "warn" | "error",
  event: string,
  fields: BillingSyncLogFields
): void {
  const line = JSON.stringify({ event, ...fields });
  if (level === "error") console.error("[billing-sync]", line);
  else if (level === "warn") console.warn("[billing-sync]", line);
  else console.info("[billing-sync]", line);
}

function stripeErrorFields(err: unknown): Pick<BillingSyncLogFields, "stripe_error_type" | "stripe_error_code"> {
  const e = err as { type?: unknown; code?: unknown } | null;
  return {
    stripe_error_type: typeof e?.type === "string" ? e.type : err instanceof Error ? err.name : "unknown",
    stripe_error_code: typeof e?.code === "string" ? e.code : null,
  };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/** Minimal Stripe surface used here (satisfied by the real Stripe client). */
export type StripeBillingApi = {
  checkout: {
    sessions: {
      retrieve(id: string, params?: { expand?: string[] }): Promise<Stripe.Checkout.Session>;
    };
  };
  subscriptions: {
    retrieve(id: string): Promise<Stripe.Subscription>;
    list(params: {
      customer: string;
      status: "all";
      limit: number;
    }): Promise<{ data: Stripe.Subscription[] }>;
  };
};

export type LinkSource = "checkout_return" | "refresh" | "page_load";

export type LinkStripeSubscriptionResult =
  | {
      ok: true;
      path: "checkout_session" | "existing_subscription" | "customer_recovery";
      subscriptionId: string;
      subscriptionStatus: string;
    }
  | {
      ok: false;
      reason: string;
      /** True when Stripe has not finished (e.g. payment still processing) — worth retrying shortly. */
      pending: boolean;
    };

export type LinkStripeSubscriptionInput = {
  stripe: StripeBillingApi;
  db: SupabaseClient;
  profile: LinkProfileFields;
  userId: string;
  planFromPriceId: PlanFromPriceId;
  source: LinkSource;
  /** Browser-supplied; only used to look up the session server-side, never trusted as-is. */
  checkoutSessionId?: string | null;
  clearPendingDowngradeWhenEssential?: boolean;
};

const PENDING_REASONS = new Set(["checkout_not_complete", "subscription_not_active_yet"]);

function fail(reason: string): LinkStripeSubscriptionResult {
  return { ok: false, reason, pending: PENDING_REASONS.has(reason) };
}

/**
 * Resolve and link the profile's legitimate Stripe subscription:
 *  1. Checkout session (when returning from Checkout) — ownership verified server-side.
 *  2. Existing `profiles.stripe_subscription_id` — re-sync from Stripe.
 *  3. Customer-based recovery — only the profile's own Stripe customer; no guessing.
 */
export async function linkStripeSubscriptionForProfile(
  input: LinkStripeSubscriptionInput
): Promise<LinkStripeSubscriptionResult> {
  const { stripe, db, profile, userId, planFromPriceId, source } = input;
  const profileId = String(profile.id);
  const customerId = String(profile.stripe_customer_id ?? "").trim();
  const sessionId = String(input.checkoutSessionId ?? "").trim() || null;
  const baseLog: BillingSyncLogFields = {
    source,
    profile_id: profileId,
    customer: stripeIdSuffix(customerId),
    checkout_session: stripeIdSuffix(sessionId),
  };

  if (!customerId) {
    logBillingSync("warn", "link_skipped", { ...baseLog, reason: "missing_stripe_customer" });
    return fail("missing_stripe_customer");
  }

  const ctx: OwnershipContext = { customerId, profileId, planFromPriceId };
  let subscription: Stripe.Subscription | null = null;
  let path: "checkout_session" | "existing_subscription" | "customer_recovery" | null = null;

  // 1. Checkout session
  if (sessionId) {
    let session: Stripe.Checkout.Session | null = null;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    } catch (err) {
      logBillingSync("warn", "checkout_session_retrieve_failed", {
        ...baseLog,
        reason: "checkout_session_retrieve_failed",
        ...stripeErrorFields(err),
      });
    }
    if (session) {
      const check = validateCheckoutSessionOwnership(session, ctx);
      if (!check.ok) {
        const ownership =
          check.reason === "checkout_customer_mismatch" || check.reason === "checkout_profile_mismatch";
        logBillingSync(ownership ? "error" : "warn", "checkout_session_rejected", {
          ...baseLog,
          reason: check.reason,
        });
        // Never recover on behalf of a session that belongs to someone else.
        if (ownership || check.reason === "checkout_not_complete") return fail(check.reason);
      } else {
        try {
          subscription =
            check.expandedSubscription ?? (await stripe.subscriptions.retrieve(check.subscriptionId));
        } catch (err) {
          logBillingSync("error", "subscription_retrieve_failed", {
            ...baseLog,
            subscription: stripeIdSuffix(check.subscriptionId),
            reason: "subscription_retrieve_failed",
            ...stripeErrorFields(err),
          });
          return fail("subscription_retrieve_failed");
        }
        if (subscription.id !== check.subscriptionId) {
          logBillingSync("error", "checkout_subscription_rejected", {
            ...baseLog,
            reason: "checkout_subscription_id_mismatch",
          });
          return fail("checkout_subscription_id_mismatch");
        }
        const subCheck = validateSubscriptionForProfile(subscription, ctx);
        if (!subCheck.ok) {
          logBillingSync(subCheck.reason === "subscription_not_active_yet" ? "warn" : "error",
            "checkout_subscription_rejected", {
              ...baseLog,
              subscription: stripeIdSuffix(subscription.id),
              subscription_status: subscription.status,
              reason: subCheck.reason,
            });
          return fail(subCheck.reason);
        }
        path = "checkout_session";
      }
    }
  }

  async function listCustomerSubscriptions(): Promise<Stripe.Subscription[] | null> {
    try {
      return (await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 })).data;
    } catch (err) {
      logBillingSync("error", "customer_subscriptions_list_failed", {
        ...baseLog,
        reason: "customer_subscriptions_list_failed",
        ...stripeErrorFields(err),
      });
      return null;
    }
  }

  // 2. Existing linked subscription
  const existingSubId = String(profile.stripe_subscription_id ?? "").trim();
  if (!subscription && existingSubId) {
    let existing: Stripe.Subscription;
    try {
      existing = await stripe.subscriptions.retrieve(existingSubId);
    } catch (err) {
      logBillingSync("error", "subscription_retrieve_failed", {
        ...baseLog,
        subscription: stripeIdSuffix(existingSubId),
        reason: "subscription_retrieve_failed",
        ...stripeErrorFields(err),
      });
      return fail("subscription_retrieve_failed");
    }
    const check = validateSubscriptionForProfile(existing, ctx, {
      requireLinkableStatus: false,
      requireJobProofPrice: false,
    });
    if (!check.ok) {
      logBillingSync("error", "existing_subscription_rejected", {
        ...baseLog,
        subscription: stripeIdSuffix(existingSubId),
        reason: check.reason,
      });
      return fail(check.reason);
    }
    subscription = existing;
    path = "existing_subscription";

    // A stale (e.g. canceled) link must not hide a newer current subscription.
    if (!LINKABLE_SUBSCRIPTION_STATUSES.has(existing.status)) {
      const list = await listCustomerSubscriptions();
      const selection = list ? selectRecoverableSubscription(list, ctx) : null;
      if (selection?.ok && selection.subscription.id !== existing.id) {
        subscription = selection.subscription;
        path = "customer_recovery";
      }
    }
  }

  // 3. Customer-based recovery
  if (!subscription) {
    const list = await listCustomerSubscriptions();
    if (!list) return fail("customer_subscriptions_list_failed");
    const selection = selectRecoverableSubscription(list, ctx);
    if (!selection.ok) {
      logBillingSync(selection.reason === "ambiguous_subscriptions" ? "error" : "info",
        "customer_recovery_no_link", {
          ...baseLog,
          reason: selection.reason,
          candidate_count: selection.candidateCount,
        });
      return fail(selection.reason);
    }
    subscription = selection.subscription;
    path = "customer_recovery";
  }

  const patch = buildProfileSubscriptionPatch(subscription, profile, planFromPriceId, {
    clearPendingDowngradeWhenEssential: input.clearPendingDowngradeWhenEssential,
  });
  const write = await writeProfileSubscriptionPatch(db, { profileId, userId, patch });
  if (!write.ok) {
    logBillingSync("error", "profile_write_failed", {
      ...baseLog,
      subscription: stripeIdSuffix(subscription.id),
      reason: write.reason,
      db_message: write.message,
    });
    return fail(write.reason);
  }

  logBillingSync("info", "subscription_linked", {
    ...baseLog,
    subscription: stripeIdSuffix(subscription.id),
    subscription_status: subscription.status,
    reason: path ?? undefined,
  });
  return {
    ok: true,
    path: path ?? "customer_recovery",
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
  };
}
