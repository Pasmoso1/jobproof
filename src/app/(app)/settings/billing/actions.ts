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
  getPlanFromStripePriceId,
  getStripe,
  getStripePriceId,
  resolveAppUrl,
} from "@/lib/stripe";

const SUBSCRIPTION_STATUSES_BLOCKING_NEW_CHECKOUT = new Set([
  "trialing",
  "active",
  "past_due",
  "incomplete",
]);

function subscriptionPeriodEndUnix(sub: Stripe.Subscription): number | null {
  const end = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return typeof end === "number" ? end : null;
}

function unixToIso(ts?: number | null): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

function tierFromMetadata(v: unknown): BillingPlanTier | null {
  return v === "essential" || v === "professional" ? v : null;
}

function pricingFromMetadata(v: unknown): BillingPricingVersion | null {
  return v === "founder" || v === "standard" ? v : null;
}

async function findBlockingJobProofSubscription(
  stripe: Stripe,
  customerId: string,
  profileId: string
): Promise<Stripe.Subscription | null> {
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 30,
  });
  const pid = String(profileId);
  const candidates = list.data.filter((s) => {
    if (String(s.metadata?.profile_id ?? "") === pid) return true;
    const priceId = s.items.data[0]?.price?.id;
    return Boolean(priceId && getPlanFromStripePriceId(priceId));
  });
  const blocking = candidates.filter((s) => SUBSCRIPTION_STATUSES_BLOCKING_NEW_CHECKOUT.has(s.status));
  if (!blocking.length) return null;
  blocking.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
  return blocking[0] ?? null;
}

export type BillingPortalSessionResult =
  | { success: true; url: string }
  | { success: false; error: string };

export type SubscriptionCheckoutSessionResult =
  | { success: true; url: string }
  | { success: false; error: string };

function logStripeError(
  context: string,
  err: {
    requestId?: string;
    code?: string;
    param?: string;
    type?: string;
  }
) {
  console.error(`[stripe] ${context}`, {
    requestId: err.requestId ?? null,
    code: err.code ?? null,
    param: err.param ?? null,
    type: err.type ?? null,
  });
}

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

    const existingSub = await findBlockingJobProofSubscription(
      stripe,
      customerId,
      String(profile.id)
    );
    if (existingSub) {
      return {
        success: false,
        error:
          "You already have a subscription for this account. Use Manage billing to change your plan or payment method.",
      };
    }

    const appUrl = resolveAppUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      success_url: `${appUrl}/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
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
    if (isStripeCustomerMissingError(err)) {
      await clearStaleJobProofStripeBilling(supabase, profile.id);
      return {
        success: false,
        error: "Billing customer was not found. Please start a new checkout session.",
      };
    }
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      logStripeError("createSubscriptionCheckoutSession invalid request", err);
      const isMissingPrice =
        (err.code === "resource_missing" && err.param === "price") ||
        /no such price/i.test(err.message ?? "");
      if (isMissingPrice) {
        return {
          success: false,
          error:
            "Stripe price not found. Check that your Stripe keys and price IDs are from the same mode.",
        };
      }
      return {
        success: false,
        error: "Could not start checkout. Please try again or contact support.",
      };
    }
    if (err instanceof Stripe.errors.StripeError) {
      logStripeError("createSubscriptionCheckoutSession stripe error", err);
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

/**
 * After returning from Stripe Checkout, pull the latest subscription into `profiles`
 * so the billing page is accurate even if the webhook is slightly delayed.
 */
export async function syncSubscriptionAfterStripeReturn(input: {
  checkoutSessionId?: string | null;
}): Promise<void> {
  const { supabase, user, profile } = await requireContractorProfile();
  const customerId = (profile.stripe_customer_id as string | null)?.trim() || null;
  if (!customerId) return;

  const stripe = getStripe();
  const profileIdStr = String(profile.id);
  let sub: Stripe.Subscription | null = null;
  const sessionId = input.checkoutSessionId?.trim() || null;

  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
      if (session.mode !== "subscription") return;
      if (String(session.customer ?? "") !== customerId) return;
      if (String(session.metadata?.profile_id ?? "") !== profileIdStr) return;
      const subRes = session.subscription;
      if (subRes && typeof subRes === "object") {
        sub = subRes as Stripe.Subscription;
      } else if (typeof subRes === "string" && subRes) {
        sub = await stripe.subscriptions.retrieve(subRes);
      }
    } catch {
      /* Invalid session id, wrong customer, or Stripe error — try fallbacks below. */
    }
  }

  if (!sub) {
    const existingSubId = (profile.stripe_subscription_id as string | null)?.trim() || null;
    if (existingSubId) {
      try {
        const r = await stripe.subscriptions.retrieve(existingSubId);
        if (String(r.customer) === customerId) sub = r;
      } catch {
        /* ignore */
      }
    }
  }

  if (!sub) {
    try {
      const list = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 25,
      });
      const candidates = list.data.filter(
        (s) =>
          String(s.metadata?.profile_id ?? "") === profileIdStr ||
          Boolean(s.items.data[0]?.price?.id && getPlanFromStripePriceId(s.items.data[0].price.id))
      );
      sub = candidates.sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0] ?? null;
    } catch {
      return;
    }
  }

  if (!sub || String(sub.customer) !== customerId) return;

  const priceId = sub.items.data[0]?.price?.id ?? null;
  const plan = priceId ? getPlanFromStripePriceId(priceId) : null;
  const metaTier = tierFromMetadata(sub.metadata?.plan_tier);
  const metaPricing = pricingFromMetadata(sub.metadata?.pricing_version);

  await supabase
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      plan_tier: plan?.planTier ?? metaTier ?? profile.plan_tier ?? null,
      pricing_version: plan?.pricingVersion ?? metaPricing ?? profile.pricing_version ?? null,
      subscription_status: sub.status,
      subscription_current_period_end: unixToIso(subscriptionPeriodEndUnix(sub)),
      trial_ends_at: unixToIso(sub.trial_end ?? null),
    })
    .eq("id", profile.id)
    .eq("user_id", user.id);
}

