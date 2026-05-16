import type Stripe from "stripe";

function toIso(ts?: number | null): string | null {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts * 1000).toISOString();
}

/** Maps Stripe `Subscription` cancellation fields to `profiles` columns. */
export function subscriptionCancellationDbFields(sub: Stripe.Subscription): {
  subscription_cancel_at_period_end: boolean;
  subscription_cancel_at: string | null;
  subscription_canceled_at: string | null;
} {
  return {
    subscription_cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    subscription_cancel_at: toIso(sub.cancel_at ?? null),
    subscription_canceled_at: toIso(sub.canceled_at ?? null),
  };
}
