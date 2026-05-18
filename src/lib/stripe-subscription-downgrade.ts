import Stripe from "stripe";
import type { BillingPricingVersion } from "@/lib/stripe";
import { getStripePriceId } from "@/lib/stripe";
import { subscriptionPeriodEndUnix, unixToIso } from "@/lib/stripe-subscription-profile-sync";

function scheduleIdFromSubscription(sub: Stripe.Subscription): string | null {
  const raw = sub.schedule;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id;
}

/**
 * Schedules Essential at the end of the current billing period via Stripe Subscription Schedules.
 * Professional price remains until period end (no proration credits on the current phase).
 */
export async function scheduleEssentialDowngradeAtPeriodEnd(input: {
  stripe: Stripe;
  sub: Stripe.Subscription;
  essentialPriceId: string;
  pricingVersion: BillingPricingVersion;
  profileId: string;
}): Promise<{ scheduleId: string; effectiveAtIso: string }> {
  const { stripe, sub, essentialPriceId, pricingVersion, profileId } = input;
  const subId = sub.id;
  const periodEndUnix = subscriptionPeriodEndUnix(sub);
  if (periodEndUnix == null || periodEndUnix <= Math.floor(Date.now() / 1000)) {
    throw new Error("Could not determine the end of the current billing period.");
  }

  const currentItem = sub.items.data[0];
  const currentPriceId = currentItem?.price?.id;
  if (!currentItem?.id || !currentPriceId) {
    throw new Error("Subscription has no billable items to schedule.");
  }

  let scheduleId = scheduleIdFromSubscription(sub);
  let schedule: Stripe.SubscriptionSchedule;

  if (scheduleId) {
    schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  } else {
    schedule = await stripe.subscriptionSchedules.create({ from_subscription: subId });
    scheduleId = schedule.id;
  }

  const phase0 = schedule.phases[0];
  if (!phase0) {
    throw new Error("Subscription schedule has no phases.");
  }

  const phaseStart = phase0.start_date;
  const meta: Record<string, string> = {
    profile_id: profileId,
    plan_tier: "essential",
    pricing_version: pricingVersion,
  };

  await stripe.subscriptionSchedules.update(scheduleId, {
    end_behavior: "release",
    phases: [
      {
        items: [{ price: currentPriceId, quantity: 1 }],
        start_date: phaseStart,
        end_date: periodEndUnix,
        metadata: {
          ...Object.fromEntries(
            Object.entries(sub.metadata ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)])
          ),
          profile_id: profileId,
          plan_tier: "professional",
          pricing_version: pricingVersion,
        },
      },
      {
        items: [{ price: essentialPriceId, quantity: 1 }],
        start_date: periodEndUnix,
        metadata: meta,
      },
    ],
  });

  return {
    scheduleId,
    effectiveAtIso: unixToIso(periodEndUnix) ?? new Date(periodEndUnix * 1000).toISOString(),
  };
}

export function essentialPriceIdForProfile(pricingVersion: BillingPricingVersion): string {
  return getStripePriceId("essential", pricingVersion);
}
