import Stripe from "stripe";

export type BillingPlanTier = "essential" | "professional";
export type BillingPricingVersion = "founder" | "standard";

function getEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`[stripe] Missing required environment variable: ${name}`);
  }
  return value;
}

export function getStripeSecretKey(): string {
  return getEnv("STRIPE_SECRET_KEY");
}

export function getStripeWebhookSecret(): string {
  return getEnv("STRIPE_WEBHOOK_SECRET");
}

export function getStripePublishableKey(): string {
  return getEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
}

export function getStripePriceId(
  planTier: BillingPlanTier,
  pricingVersion: BillingPricingVersion
): string {
  const map: Record<`${BillingPlanTier}:${BillingPricingVersion}`, string> = {
    "essential:founder": getEnv("STRIPE_PRICE_ESSENTIAL_FOUNDER"),
    "professional:founder": getEnv("STRIPE_PRICE_PROFESSIONAL_FOUNDER"),
    "essential:standard": getEnv("STRIPE_PRICE_ESSENTIAL_STANDARD"),
    "professional:standard": getEnv("STRIPE_PRICE_PROFESSIONAL_STANDARD"),
  };
  return map[`${planTier}:${pricingVersion}`];
}

export function getPlanFromStripePriceId(priceId: string): {
  planTier: BillingPlanTier;
  pricingVersion: BillingPricingVersion;
} | null {
  const pairs: Array<[BillingPlanTier, BillingPricingVersion]> = [
    ["essential", "founder"],
    ["professional", "founder"],
    ["essential", "standard"],
    ["professional", "standard"],
  ];
  for (const [planTier, pricingVersion] of pairs) {
    if (getStripePriceId(planTier, pricingVersion) === priceId) {
      return { planTier, pricingVersion };
    }
  }
  return null;
}

let stripeSingleton: Stripe | null = null;
export function getStripe(): Stripe {
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(getStripeSecretKey(), {
      // Dashboard webhooks use 2025-05-28.basil; stripe-node types default to the SDK’s pinned version.
      // @ts-expect-error — intentional runtime API version for webhook parity
      apiVersion: "2025-05-28.basil",
      typescript: true,
    });
  }
  return stripeSingleton;
}

export function resolveAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

