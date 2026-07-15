/**
 * Push JobProof business address to an existing Stripe Customer for Tax.
 * Creates a customer only via ensureStripeCustomerForProfile when missing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { PRODUCT_ANALYTICS_EVENTS, trackProductEventSafe } from "@/lib/product-analytics";
import { ensureStripeCustomerForProfile } from "@/lib/stripe-customer";
import {
  syncStripeCustomerBillingAddress,
  validateStripeBillingAddressSource,
  type StripeBillingAddressSource,
} from "@/lib/stripe-subscription-tax";

export type SyncProfileBillingAddressToStripeResult =
  | { ok: true; customerId: string; skipped?: false }
  | { ok: true; skipped: true; reason: "incomplete_address" | "no_stripe_needed" }
  | { ok: false; error: string; customerId?: string };

type SyncProfile = StripeBillingAddressSource & {
  id: string;
  stripe_customer_id?: string | null;
  /** When false/undefined and no customer, skip create (e.g. never subscribed). */
  requireCustomer?: boolean;
};

/**
 * Sync address to Stripe Customer. By default creates a customer if missing when
 * requireCustomer is true (used before Checkout). When requireCustomer is false
 * and no customer exists, skips (profile save for never-subscribed contractors).
 */
export async function syncProfileBillingAddressToStripe(input: {
  stripe: Stripe;
  supabase: SupabaseClient;
  profile: SyncProfile;
  userEmail?: string | null;
  source: string;
  requireCustomer?: boolean;
}): Promise<SyncProfileBillingAddressToStripeResult> {
  const { stripe, supabase, profile, userEmail, source } = input;
  const requireCustomer = input.requireCustomer === true;

  const validated = validateStripeBillingAddressSource(profile);
  if (!validated.ok) {
    return { ok: true, skipped: true, reason: "incomplete_address" };
  }

  const hasCustomer = Boolean(String(profile.stripe_customer_id ?? "").trim());
  if (!hasCustomer && !requireCustomer) {
    return { ok: true, skipped: true, reason: "no_stripe_needed" };
  }

  try {
    const { customerId } = await ensureStripeCustomerForProfile(
      stripe,
      supabase,
      profile,
      userEmail
    );
    await syncStripeCustomerBillingAddress(stripe, customerId, validated.address);

    await supabase
      .from("profiles")
      .update({
        stripe_billing_address_synced_at: new Date().toISOString(),
        stripe_billing_address_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    trackProductEventSafe({
      profileId: String(profile.id),
      eventName: PRODUCT_ANALYTICS_EVENTS.stripe_customer_address_synced,
      source,
      metadata: {
        province_code: validated.address.state,
        country: validated.address.country,
      },
    });

    return { ok: true, customerId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe address sync failed";
    console.error("[stripe-tax] customer address sync failed", {
      profile_id: profile.id,
      stripe_customer_id: profile.stripe_customer_id ?? null,
      error_name: err instanceof Error ? err.name : "unknown",
      // Avoid logging full address
    });

    await supabase
      .from("profiles")
      .update({
        stripe_billing_address_sync_error: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    trackProductEventSafe({
      profileId: String(profile.id),
      eventName: PRODUCT_ANALYTICS_EVENTS.stripe_customer_address_sync_failed,
      source,
      metadata: { error_code: err instanceof Error ? err.name : "unknown" },
    });

    return { ok: false, error: message, customerId: profile.stripe_customer_id ?? undefined };
  }
}
