/**
 * Pure eligibility helpers for GA4 first-paid purchase after Stripe Checkout.
 * Aligns with isFirstPaidSubscriptionTransition; handles webhook race via session age.
 */

import { isFirstPaidSubscriptionTransition } from "@/lib/trial-conversion";
import type { BillingPlanTier, BillingPricingVersion } from "@/lib/stripe";
import { parseBillingPlanTier, parseBillingPricingVersion } from "@/lib/billing-plan-display";

/** Checkout sessions older than this are not eligible for acquisition purchase. */
export const GA4_PURCHASE_SESSION_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/**
 * Normalize Stripe Checkout `session.subscription` to a subscription ID string.
 * Accepts a string ID or an expanded object with `id`.
 */
export function normalizeCheckoutSessionSubscriptionId(
  subscription: unknown
): string | null {
  if (subscription == null) return null;
  if (typeof subscription === "string") {
    const id = subscription.trim();
    return id || null;
  }
  if (typeof subscription === "object" && subscription !== null && "id" in subscription) {
    const id = String((subscription as { id?: unknown }).id ?? "").trim();
    return id || null;
  }
  return null;
}

export type Ga4PurchaseEligibilityInput = {
  authSucceeded: boolean;
  checkoutSessionId: string | null | undefined;
  sessionMode: string | null | undefined;
  /** Stripe Checkout payment_status */
  paymentStatus: string | null | undefined;
  /** Stripe Checkout session status */
  sessionStatus: string | null | undefined;
  sessionCustomerMatchesProfile: boolean;
  sessionProfileMetadataMatches: boolean;
  sessionCreatedUnix: number | null | undefined;
  nowMs?: number;
  previousSubscriptionStatus: string | null | undefined;
  newSubscriptionStatus: string | null | undefined;
  /** Normalized subscription id from Checkout session.subscription */
  checkoutSessionSubscriptionId: string | null | undefined;
  /** profiles.stripe_subscription_id after billing sync */
  profileStripeSubscriptionId: string | null | undefined;
};

export type Ga4PurchaseEligibilityResult =
  | {
      eligible: true;
      reason: "first_paid_transition" | "webhook_race_recent_checkout";
    }
  | {
      eligible: false;
      reason: string;
    };

function sessionLooksPaid(input: Ga4PurchaseEligibilityInput): boolean {
  const pay = String(input.paymentStatus ?? "").toLowerCase();
  const st = String(input.sessionStatus ?? "").toLowerCase();
  if (pay === "paid") return true;
  // Some subscription checkouts report complete + unpaid until invoice settles;
  // require paid for acquisition purchase to avoid incomplete Checkout.
  if (st === "complete" && pay === "paid") return true;
  return false;
}

export function evaluateGa4PurchaseEligibility(
  input: Ga4PurchaseEligibilityInput
): Ga4PurchaseEligibilityResult {
  if (!input.authSucceeded) {
    return { eligible: false, reason: "auth_failed" };
  }
  const sessionId = String(input.checkoutSessionId ?? "").trim();
  if (!sessionId) {
    return { eligible: false, reason: "missing_session_id" };
  }
  if (String(input.sessionMode ?? "").toLowerCase() !== "subscription") {
    return { eligible: false, reason: "not_subscription_checkout" };
  }
  if (!input.sessionCustomerMatchesProfile || !input.sessionProfileMetadataMatches) {
    return { eligible: false, reason: "session_profile_mismatch" };
  }
  if (!sessionLooksPaid(input)) {
    return { eligible: false, reason: "checkout_not_paid" };
  }

  const checkoutSubId = String(input.checkoutSessionSubscriptionId ?? "").trim();
  const profileSubId = String(input.profileStripeSubscriptionId ?? "").trim();
  if (!checkoutSubId) {
    return { eligible: false, reason: "checkout_subscription_missing" };
  }
  if (!profileSubId) {
    return { eligible: false, reason: "subscription_missing" };
  }
  if (checkoutSubId !== profileSubId) {
    return { eligible: false, reason: "subscription_id_mismatch" };
  }

  const next = String(input.newSubscriptionStatus ?? "").trim().toLowerCase();
  if (!["active", "trialing"].includes(next)) {
    return { eligible: false, reason: "subscription_not_paid_status" };
  }

  const createdUnix = input.sessionCreatedUnix;
  const now = input.nowMs ?? Date.now();
  const sessionFresh =
    typeof createdUnix === "number" &&
    createdUnix > 0 &&
    now - createdUnix * 1000 <= GA4_PURCHASE_SESSION_MAX_AGE_MS;

  // Subscription identity already verified above — applies to both paths below.
  if (isFirstPaidSubscriptionTransition(input.previousSubscriptionStatus, next)) {
    if (!sessionFresh) {
      return { eligible: false, reason: "session_too_old" };
    }
    return { eligible: true, reason: "first_paid_transition" };
  }

  // Webhook may have already moved the profile to paid before this page load.
  // Still allow once per recent paid Checkout session (client once-key dedupes).
  const prev = String(input.previousSubscriptionStatus ?? "").trim().toLowerCase();
  if (["active", "trialing", "past_due"].includes(prev) && sessionFresh) {
    return { eligible: true, reason: "webhook_race_recent_checkout" };
  }

  return { eligible: false, reason: "not_first_paid_transition" };
}

export function resolveGa4PurchasePlanFromSession(input: {
  metadataPlanTier?: string | null;
  metadataPricingVersion?: string | null;
  pricePlanTier?: BillingPlanTier | null;
  pricePricingVersion?: BillingPricingVersion | null;
  profilePlanTier?: string | null;
  profilePricingVersion?: string | null;
}): { planTier: BillingPlanTier; pricingVersion: BillingPricingVersion } | null {
  const planTier =
    input.pricePlanTier ??
    parseBillingPlanTier(String(input.metadataPlanTier ?? "")) ??
    parseBillingPlanTier(String(input.profilePlanTier ?? ""));
  if (!planTier) return null;
  const pricingVersion =
    input.pricePricingVersion ??
    parseBillingPricingVersion(String(input.metadataPricingVersion ?? "")) ??
    parseBillingPricingVersion(String(input.profilePricingVersion ?? "")) ??
    "standard";
  return { planTier, pricingVersion };
}

/** Prefer Checkout amount_subtotal (pre-tax) in major currency units. */
export function resolveGa4PurchaseValueCad(input: {
  amountSubtotalCents?: number | null;
  amountTotalCents?: number | null;
  listPriceCad: number;
}): number {
  if (
    typeof input.amountSubtotalCents === "number" &&
    Number.isFinite(input.amountSubtotalCents) &&
    input.amountSubtotalCents >= 0
  ) {
    return Math.round(input.amountSubtotalCents) / 100;
  }
  return input.listPriceCad;
}
