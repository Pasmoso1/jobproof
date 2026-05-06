"use server";

import { redirect } from "next/navigation";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import {
  clearStaleJobProofStripeBilling,
  ensureStripeCustomerForProfile,
  isStripeCustomerMissingError,
} from "@/lib/stripe-customer";
import {
  type BillingPlanTier,
  type BillingPricingVersion,
  getStripe,
  getStripePriceId,
  resolveAppUrl,
} from "@/lib/stripe";

export type BillingPortalSessionResult =
  | { success: true; url: string }
  | { success: false; error: string };

export type SubscriptionCheckoutSessionResult =
  | { success: true; url: string }
  | { success: false; error: string };

async function requireContractorProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    throw new Error("Profile not found.");
  }
  return { supabase, user, profile };
}

export async function createSubscriptionCheckoutSession(params: {
  planTier: BillingPlanTier;
}): Promise<SubscriptionCheckoutSessionResult> {
  const { supabase, user, profile } = await requireContractorProfile();

  try {
    const stripe = getStripe();

    const pricingVersion: BillingPricingVersion =
      profile.pricing_version === "standard" ? "standard" : "founder";
    let priceId: string;
    try {
      priceId = getStripePriceId(params.planTier, pricingVersion);
    } catch {
      return {
        success: false,
        error: "Subscription checkout is not available right now. Please contact support.",
      };
    }

    const { customerId } = await ensureStripeCustomerForProfile(
      stripe,
      supabase,
      profile,
      user.email
    );

    const appUrl = resolveAppUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      success_url: `${appUrl}/settings/billing?checkout=success`,
      cancel_url: `${appUrl}/settings/billing?checkout=cancelled`,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          profile_id: String(profile.id),
          plan_tier: params.planTier,
          pricing_version: pricingVersion,
        },
      },
      metadata: {
        profile_id: String(profile.id),
        plan_tier: params.planTier,
        pricing_version: pricingVersion,
      },
    });

    if (!session.url) {
      return {
        success: false,
        error: "Checkout did not return a URL. Please try again or contact support.",
      };
    }
    return { success: true, url: session.url };
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      return {
        success: false,
        error: "Could not start checkout. Please try again or contact support.",
      };
    }
    if (err instanceof Stripe.errors.StripeError) {
      return {
        success: false,
        error: "Could not reach Stripe. Please try again in a moment.",
      };
    }
    throw err;
  }
}

export async function createBillingPortalSession(): Promise<BillingPortalSessionResult> {
  const { supabase, profile } = await requireContractorProfile();
  const customerId = (profile.stripe_customer_id as string | null)?.trim() || null;
  if (!customerId) {
    return {
      success: false,
      error: "Billing customer was not found. Please start a new checkout session.",
    };
  }

  const stripe = getStripe();
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${resolveAppUrl()}/settings/billing`,
    });
    if (!session.url) {
      return { success: false, error: "Billing portal did not return a URL." };
    }
    return { success: true, url: session.url };
  } catch (err) {
    if (isStripeCustomerMissingError(err)) {
      await clearStaleJobProofStripeBilling(supabase, profile.id);
      return {
        success: false,
        error: "Billing customer was not found. Please start a new checkout session.",
      };
    }
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      return {
        success: false,
        error: "Billing portal is not available yet. Please contact support.",
      };
    }
    if (err instanceof Stripe.errors.StripeError) {
      return {
        success: false,
        error: "Could not open billing portal. Please try again in a moment.",
      };
    }
    throw err;
  }
}

export async function createStripeConnectOnboardingLink(): Promise<{ url: string }> {
  const { supabase, profile } = await requireContractorProfile();
  const stripe = getStripe();

  let accountId = (profile.stripe_connect_account_id as string | null)?.trim() || null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "CA",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { profile_id: String(profile.id) },
    });
    accountId = account.id;
    await supabase
      .from("profiles")
      .update({ stripe_connect_account_id: accountId })
      .eq("id", profile.id);
  }

  const appUrl = resolveAppUrl();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/settings/billing?stripe_connect=refresh`,
    return_url: `${appUrl}/settings/billing?stripe_connect=return`,
    type: "account_onboarding",
  });
  return { url: link.url };
}

export async function refreshStripeConnectStatus(): Promise<{ ok: true }> {
  const { supabase, profile } = await requireContractorProfile();
  const accountId = (profile.stripe_connect_account_id as string | null)?.trim() || null;
  if (!accountId) return { ok: true };

  try {
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(accountId);
    await supabase
      .from("profiles")
      .update({
        stripe_connect_charges_enabled: account.charges_enabled,
        stripe_connect_payouts_enabled: account.payouts_enabled,
        stripe_connect_details_submitted: account.details_submitted,
        stripe_connect_onboarding_complete:
          (account.charges_enabled && account.payouts_enabled) || account.details_submitted,
      })
      .eq("id", profile.id);
  } catch {
    /* Stale Connect account ids or wrong Stripe mode must not crash Server Components. */
  }
  return { ok: true };
}

