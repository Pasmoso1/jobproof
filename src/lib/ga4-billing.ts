/**
 * GA4 billing-stage events: begin_checkout + first-paid purchase.
 * Does not alter signup/onboarding funnel events.
 */

import {
  hasGa4OnceFired,
  markGa4OnceFired,
  trackGa4Event,
  type Ga4EventParams,
} from "@/lib/ga4";
import type { BillingPlanTier, BillingPricingVersion } from "@/lib/stripe";
import {
  getPlanGa4ItemName,
  getPlanListPriceCad,
} from "@/lib/billing-plan-display";

export const GA4_BILLING_EVENTS = {
  begin_checkout: "begin_checkout",
  purchase: "purchase",
} as const;

export type Ga4EcommerceItem = {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
};

export function purchaseOnceDedupeKey(checkoutSessionId: string): string {
  return `purchase:${checkoutSessionId.trim()}`;
}

export function buildSubscriptionCheckoutItem(input: {
  planTier: BillingPlanTier;
  pricingVersion: BillingPricingVersion;
  priceCad?: number;
}): Ga4EcommerceItem {
  const price =
    typeof input.priceCad === "number" && Number.isFinite(input.priceCad)
      ? input.priceCad
      : getPlanListPriceCad(input.planTier, input.pricingVersion);
  return {
    item_id: input.planTier,
    item_name: getPlanGa4ItemName(input.planTier),
    price,
    quantity: 1,
  };
}

export function buildBeginCheckoutParams(input: {
  planTier: BillingPlanTier;
  pricingVersion: BillingPricingVersion;
  currency?: string;
  valueCad?: number;
}): Ga4EventParams & { items: Ga4EcommerceItem[] } {
  const item = buildSubscriptionCheckoutItem({
    planTier: input.planTier,
    pricingVersion: input.pricingVersion,
    priceCad: input.valueCad,
  });
  return {
    currency: input.currency ?? "CAD",
    value: item.price,
    items: [item],
  };
}

export function buildPurchaseParams(input: {
  transactionId: string;
  planTier: BillingPlanTier;
  pricingVersion: BillingPricingVersion;
  currency?: string;
  valueCad?: number;
}): Ga4EventParams & { items: Ga4EcommerceItem[]; transaction_id: string } {
  const item = buildSubscriptionCheckoutItem({
    planTier: input.planTier,
    pricingVersion: input.pricingVersion,
    priceCad: input.valueCad,
  });
  return {
    transaction_id: input.transactionId,
    currency: input.currency ?? "CAD",
    value: item.price,
    items: [item],
  };
}

/** Fire when Stripe Checkout URL was successfully created and user is proceeding. */
export function trackBeginCheckout(input: {
  planTier: BillingPlanTier;
  pricingVersion: BillingPricingVersion;
  currency?: string;
  valueCad?: number;
}): boolean {
  return trackGa4Event(
    GA4_BILLING_EVENTS.begin_checkout,
    buildBeginCheckoutParams(input)
  );
}

/**
 * Fire purchase once per Checkout session id.
 * Call only after server eligibility is confirmed.
 * Marks the once-key before send (same pattern as trackGa4EventOnce) so remounts
 * cannot double-fire; do not call this for failed/incomplete verification.
 */
export function trackPurchaseOnce(input: {
  transactionId: string;
  planTier: BillingPlanTier;
  pricingVersion: BillingPricingVersion;
  currency?: string;
  valueCad?: number;
}): boolean {
  const id = input.transactionId.trim();
  if (!id) return false;
  const key = purchaseOnceDedupeKey(id);
  if (hasGa4OnceFired(key)) return false;
  markGa4OnceFired(key);
  const params = buildPurchaseParams({
    transactionId: id,
    planTier: input.planTier,
    pricingVersion: input.pricingVersion,
    currency: input.currency,
    valueCad: input.valueCad,
  });
  return trackGa4Event(GA4_BILLING_EVENTS.purchase, params);
}

/** Test helper: whether purchase once-key is set (does not fire). */
export function hasPurchaseOnceFired(checkoutSessionId: string): boolean {
  return hasGa4OnceFired(purchaseOnceDedupeKey(checkoutSessionId));
}
