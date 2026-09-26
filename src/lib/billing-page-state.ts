/**
 * Billing page state after Stripe Checkout and for paid vs managed-trial display.
 * `?checkout=success` is only a hint to sync — never evidence of a subscription.
 */

import { formatSubscriptionStatusLabel, getPlanDisplayLinesForProfile } from "@/lib/billing-plan-display";
import {
  hasLinkedPaidSubscription,
  isJobProofManagedTrialActive,
  type TrialLifecycleProfile,
} from "@/lib/trial-lifecycle";

export type CheckoutReturnState = "none" | "subscribed" | "confirming" | "sync_failed";

export type CheckoutSyncOutcome = { ok: true } | { ok: false; pending: boolean };

type BillingStateProfile = TrialLifecycleProfile & {
  beta_plan_tier?: string | null;
  pricing_version?: string | null;
  subscription_current_period_end?: string | null;
};

export function resolveCheckoutReturnState(input: {
  checkoutSuccess: boolean;
  profile: BillingStateProfile;
  syncOutcome: CheckoutSyncOutcome | null;
}): CheckoutReturnState {
  if (!input.checkoutSuccess) return "none";
  if (hasLinkedPaidSubscription(input.profile)) return "subscribed";
  if (input.syncOutcome && !input.syncOutcome.ok && !input.syncOutcome.pending) return "sync_failed";
  return "confirming";
}

export type SubscribedSummary = {
  planLine: string | null;
  statusLabel: string;
  /** Stripe-side trial (not the JobProof-managed trial). */
  isStripeTrialing: boolean;
  nextBillingDateIso: string | null;
};

/** Values for the "You're subscribed" panel — only meaningful once a paid subscription is linked. */
export function buildSubscribedSummary(profile: BillingStateProfile): SubscribedSummary {
  const status = String(profile.subscription_status ?? "").trim().toLowerCase();
  const periodEnd = String(profile.subscription_current_period_end ?? "").trim();
  return {
    planLine: getPlanDisplayLinesForProfile(profile)?.planLine ?? null,
    statusLabel: formatSubscriptionStatusLabel(status),
    isStripeTrialing: status === "trialing",
    nextBillingDateIso: periodEnd || null,
  };
}

/** Managed-trial countdown / "locked until you subscribe" panel. */
export function shouldShowManagedTrialPanel(input: {
  profile: BillingStateProfile;
  checkoutReturnState: CheckoutReturnState;
  isBetaTester: boolean;
}): boolean {
  if (input.isBetaTester) return false;
  if (input.checkoutReturnState !== "none") return false;
  if (hasLinkedPaidSubscription(input.profile)) return false;
  return isJobProofManagedTrialActive(input.profile);
}

/** Managed-trial subscribe buttons. Hidden once paid, and while a Checkout return is being confirmed. */
export function shouldShowManagedTrialSubscribeCtas(input: {
  profile: BillingStateProfile;
  checkoutReturnState: CheckoutReturnState;
  isBetaTester: boolean;
  hasActiveSubscription: boolean;
  managedTrialActiveOrStarted: boolean;
}): boolean {
  if (input.isBetaTester || input.hasActiveSubscription) return false;
  if (hasLinkedPaidSubscription(input.profile)) return false;
  if (input.checkoutReturnState !== "none") return false;
  return input.managedTrialActiveOrStarted;
}
