import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";

/** Stripe throws this when the customer id belongs to another mode/account or was deleted. */
export function isStripeCustomerMissingError(err: unknown): boolean {
  return (
    err instanceof Stripe.errors.StripeInvalidRequestError &&
    err.code === "resource_missing" &&
    err.param === "customer"
  );
}

/**
 * Clears JobProof subscription billing linkage when the Stripe customer id is invalid
 * (e.g. test vs live keys). Keeps plan tier / pricing cohort for checkout.
 */
export async function clearStaleJobProofStripeBilling(
  supabase: SupabaseClient,
  profileId: string
): Promise<void> {
  await supabase
    .from("profiles")
    .update({
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      subscription_status: "trial",
      subscription_current_period_end: null,
      trial_ends_at: null,
      grace_period_ends_at: null,
    })
    .eq("id", profileId);
}

type EnsureProfile = {
  id: string;
  stripe_customer_id?: string | null;
};

/**
 * Returns a Stripe customer id valid for the current secret key. Creates a customer when missing.
 * If the stored customer id does not exist in Stripe, clears stale billing fields and creates a new customer.
 */
export async function ensureStripeCustomerForProfile(
  stripe: Stripe,
  supabase: SupabaseClient,
  profile: EnsureProfile,
  userEmail: string | null | undefined
): Promise<{ customerId: string }> {
  let customerId = profile.stripe_customer_id?.trim() || null;

  if (customerId) {
    try {
      await stripe.customers.retrieve(customerId);
      return { customerId };
    } catch (err) {
      if (!isStripeCustomerMissingError(err)) throw err;
      await clearStaleJobProofStripeBilling(supabase, profile.id);
      customerId = null;
    }
  }

  const customer = await stripe.customers.create({
    email: userEmail ?? undefined,
    metadata: {
      profile_id: String(profile.id),
    },
  });

  await supabase.from("profiles").update({ stripe_customer_id: customer.id }).eq("id", profile.id);

  return { customerId: customer.id };
}
