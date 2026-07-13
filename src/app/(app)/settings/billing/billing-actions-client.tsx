"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BillingUiTier } from "@/lib/billing-plan-display";
import type { BillingPlanTier } from "@/lib/stripe";
import {
  createBillingPortalSession,
  createStripeConnectOnboardingLink,
  createSubscriptionCheckoutSession,
  resumeScheduledSubscriptionCancellation,
  downgradeSubscriptionToEssential,
  syncCurrentStripeSubscription,
  upgradeSubscriptionToProfessional,
} from "./actions";

function formatActionError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Something went wrong. Please try again.";
}

export function BillingActionButtons({
  isBetaTester = false,
  billingUiTier,
  upgradeProfessionalLabel,
  hasActiveSubscription,
  hasScheduledCancellation,
  scheduledCancellationEndLabel,
  showResumeSubscription,
  showDowngradeToEssential,
  hasPendingEssentialDowngrade,
  subscriptionIsTrialing,
  defaultCheckoutPlan = "essential",
  showManagedTrialSubscribe = false,
}: {
  isBetaTester?: boolean;
  billingUiTier: BillingUiTier;
  upgradeProfessionalLabel: string;
  hasActiveSubscription: boolean;
  hasScheduledCancellation: boolean;
  scheduledCancellationEndLabel: string;
  showResumeSubscription: boolean;
  showDowngradeToEssential: boolean;
  hasPendingEssentialDowngrade: boolean;
  subscriptionIsTrialing: boolean;
  defaultCheckoutPlan?: BillingPlanTier;
  /** True when JobProof-managed trial (or expired) should subscribe via Stripe with no Stripe trial. */
  showManagedTrialSubscribe?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (isBetaTester) {
    return (
      <p className="text-sm text-zinc-600">
        Subscription changes are paused during the beta. You have full access to your selected plan.
      </p>
    );
  }

  async function goCheckout(label: "essential" | "professional", planTier: BillingPlanTier) {
    setError(null);
    setSuccessMessage(null);
    setBusy(label);
    try {
      const result = await createSubscriptionCheckoutSession({ planTier });
      if (!result.success) {
        setError(result.error);
        router.refresh();
        return;
      }
      window.location.href = result.url;
    } catch (e) {
      setError(formatActionError(e));
    } finally {
      setBusy(null);
    }
  }

  async function goUpgradeProfessional() {
    setError(null);
    setSuccessMessage(null);
    setBusy("upgrade-prof");
    try {
      const result = await upgradeSubscriptionToProfessional();
      if (!result.success) {
        setError(result.error);
        router.refresh();
        return;
      }
      setSuccessMessage(result.message);
      router.refresh();
    } catch (e) {
      setError(formatActionError(e));
    } finally {
      setBusy(null);
    }
  }

  async function goPortal() {
    setError(null);
    setSuccessMessage(null);
    setBusy("portal");
    try {
      const result = await createBillingPortalSession();
      if (!result.success) {
        setError(result.error);
        router.refresh();
        return;
      }
      window.location.href = result.url;
    } catch (e) {
      setError(formatActionError(e));
    } finally {
      setBusy(null);
    }
  }

  async function goDowngradeEssential() {
    setError(null);
    setSuccessMessage(null);
    setBusy("downgrade-essential");
    try {
      const result = await downgradeSubscriptionToEssential();
      if (!result.success) {
        setError(result.error);
        router.refresh();
        return;
      }
      setSuccessMessage(result.message);
      router.refresh();
    } catch (e) {
      setError(formatActionError(e));
    } finally {
      setBusy(null);
    }
  }

  async function goResync() {
    setError(null);
    setSuccessMessage(null);
    setBusy("resync");
    try {
      const result = await syncCurrentStripeSubscription();
      if (!result.success) {
        setError(result.error);
        router.refresh();
        return;
      }
      setSuccessMessage("Billing status updated from Stripe.");
      router.refresh();
    } catch (e) {
      setError(formatActionError(e));
    } finally {
      setBusy(null);
    }
  }

  async function goResume() {
    setError(null);
    setSuccessMessage(null);
    setBusy("resume");
    try {
      const result = await resumeScheduledSubscriptionCancellation();
      if (!result.success) {
        setError(result.error);
        router.refresh();
        return;
      }
      setSuccessMessage("Your subscription will continue after the current billing period.");
      router.refresh();
    } catch (e) {
      setError(formatActionError(e));
    } finally {
      setBusy(null);
    }
  }

  const disableAll = busy !== null;

  if (!hasActiveSubscription) {
    const preferred = defaultCheckoutPlan === "professional" ? "professional" : "essential";
    const soloPrimary = preferred === "essential";
    return (
      <div className="space-y-3">
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {successMessage && (
          <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
            {successMessage}
          </p>
        )}
        <p className="text-sm text-zinc-600">
          {showManagedTrialSubscribe
            ? "Subscribe to keep creating new work. Your existing information stays saved either way. You can choose Solo or Pro before checkout."
            : "Choose a plan to subscribe. No free trial on Stripe — your JobProof trial (if any) is separate."}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void goCheckout("essential", "essential")}
            disabled={disableAll}
            className={
              soloPrimary
                ? "rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-60"
                : "rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
            }
          >
            {busy === "essential"
              ? "Opening..."
              : showManagedTrialSubscribe
                ? soloPrimary
                  ? "Subscribe to Solo — $39 CAD/mo"
                  : "Switch to Solo — $39 CAD/mo"
                : "Choose Solo — $39 CAD/mo"}
          </button>
          <button
            type="button"
            onClick={() => void goCheckout("professional", "professional")}
            disabled={disableAll}
            className={
              !soloPrimary
                ? "rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-60"
                : "rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
            }
          >
            {busy === "professional"
              ? "Opening..."
              : showManagedTrialSubscribe
                ? !soloPrimary
                  ? "Subscribe to Pro — $59 CAD/mo"
                  : "Switch to Pro — $59 CAD/mo"
                : "Choose Pro — $59 CAD/mo"}
          </button>
        </div>
        <div>
          <button
            type="button"
            onClick={() => void goResync()}
            disabled={disableAll}
            className="text-sm font-medium text-[#2436BB] underline-offset-2 hover:underline disabled:opacity-50"
          >
            {busy === "resync" ? "Refreshing…" : "Refresh billing status"}
          </button>
        </div>
        <p className="text-xs text-zinc-500">Solo — $39 CAD/month · Pro — $59 CAD/month</p>
      </div>
    );
  }

  const hideUpgrade = hasScheduledCancellation || billingUiTier === "professional";
  const showEssentialCurrent = billingUiTier === "essential";
  const showProfessionalCurrent = billingUiTier === "professional";
  const essentialSignupHidden = billingUiTier !== "none";

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {successMessage && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {successMessage}
        </p>
      )}
      {billingUiTier === "essential" && !hasScheduledCancellation ? (
        <p className="text-sm text-zinc-600">
          Need team features? Upgrade to Professional anytime.
        </p>
      ) : null}
      {billingUiTier === "professional" && !hasScheduledCancellation && !hasPendingEssentialDowngrade ? (
        <p className="text-xs text-zinc-500">
          Downgrades take effect at your next renewal.
        </p>
      ) : null}
      {hasPendingEssentialDowngrade ? (
        <p className="text-xs text-zinc-500">
          Your downgrade to Essential is scheduled. Professional stays active until your current
          billing period ends.
        </p>
      ) : null}
      {hasScheduledCancellation ? (
        <p className="text-xs text-zinc-500">
          Your subscription is scheduled to end on {scheduledCancellationEndLabel}. Resume your
          subscription in the billing portal to keep access.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {showEssentialCurrent ? (
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-500"
          >
            Current plan (Essential)
          </button>
        ) : null}
        {showProfessionalCurrent ? (
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-500"
          >
            Current plan (Professional)
          </button>
        ) : null}
        {billingUiTier === "essential" && !hideUpgrade ? (
          <button
            type="button"
            onClick={() => void goUpgradeProfessional()}
            disabled={disableAll}
            className="rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-60"
          >
            {busy === "professional"
              ? "Opening..."
              : busy === "upgrade-prof"
                ? "Upgrading..."
                : upgradeProfessionalLabel}
          </button>
        ) : null}
        {showDowngradeToEssential ? (
          <button
            type="button"
            onClick={() => void goDowngradeEssential()}
            disabled={disableAll}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
          >
            {busy === "downgrade-essential"
              ? subscriptionIsTrialing
                ? "Downgrading…"
                : "Scheduling…"
              : "Downgrade to Essential"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void goPortal()}
          disabled={disableAll}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
        >
          {busy === "portal" ? "Opening..." : "Manage billing"}
        </button>
        {!essentialSignupHidden && billingUiTier === "none" ? (
          <>
            <button
              type="button"
              onClick={() => void goCheckout("essential", "essential")}
              disabled={disableAll}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
            >
              {busy === "essential" ? "Opening..." : "Choose Essential — $29 CAD/mo"}
            </button>
            <button
              type="button"
              onClick={() => void goCheckout("professional", "professional")}
              disabled={disableAll}
              className="rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-60"
            >
              {busy === "professional" ? "Opening..." : "Choose Professional — $49 CAD/mo"}
            </button>
          </>
        ) : null}
      </div>
      {showResumeSubscription ? (
        <div>
          <button
            type="button"
            onClick={() => void goResume()}
            disabled={disableAll}
            className="rounded-lg border border-green-600 bg-green-50 px-4 py-2 text-sm font-medium text-green-900 hover:bg-green-100 disabled:opacity-60"
          >
            {busy === "resume" ? "Resuming…" : "Resume subscription"}
          </button>
        </div>
      ) : null}
      <div>
        <button
          type="button"
          onClick={() => void goResync()}
          disabled={disableAll}
          className="text-sm font-medium text-[#2436BB] underline-offset-2 hover:underline disabled:opacity-50"
        >
          {busy === "resync" ? "Refreshing…" : "Refresh billing status"}
        </button>
      </div>
      <p className="text-xs text-zinc-600">
        Founder pricing is locked in for early subscribers.
      </p>
      <p className="text-xs text-zinc-500">
        Essential — $39 CAD/month regular · Professional — $59 CAD/month regular
      </p>
    </div>
  );
}

export function StripeConnectActionButtons({
  hasConnectAccount,
  connectReady,
}: {
  hasConnectAccount: boolean;
  connectReady: boolean;
}) {
  const onboardingIncomplete = hasConnectAccount && !connectReady;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function goConnect() {
    setError(null);
    setBusy(true);
    try {
      const { url } = await createStripeConnectOnboardingLink();
      window.location.href = url;
    } catch (e) {
      setError(formatActionError(e));
    } finally {
      setBusy(false);
    }
  }

  if (connectReady) {
    return (
      <div className="mt-4 space-y-1">
        <p className="text-sm font-medium text-zinc-900">Stripe payments enabled</p>
        <p className="text-sm text-zinc-600">
          Customers can pay invoices online by card.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void goConnect()}
        disabled={busy}
        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
      >
        {busy ? "Opening..." : onboardingIncomplete ? "Continue Stripe setup" : "Connect Stripe"}
      </button>
      <p className="text-xs text-zinc-600">
        {onboardingIncomplete
          ? "Finish Stripe setup to enable online invoice payments."
          : "Select Connect Stripe to create or connect your Stripe account so you can accept credit card payments from customers."}
      </p>
    </div>
  );
}
