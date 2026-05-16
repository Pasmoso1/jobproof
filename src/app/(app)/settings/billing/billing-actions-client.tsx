"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BillingUiTier } from "@/lib/billing-plan-display";
import type { BillingPlanTier } from "@/lib/stripe";
import {
  createBillingPortalSession,
  createStripeConnectOnboardingLink,
  createSubscriptionCheckoutSession,
  syncCurrentStripeSubscription,
  upgradeSubscriptionToProfessional,
} from "./actions";

function formatActionError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Something went wrong. Please try again.";
}

export function BillingActionButtons({
  billingUiTier,
  upgradeProfessionalLabel,
  hasStripeSubscription,
}: {
  billingUiTier: BillingUiTier;
  upgradeProfessionalLabel: string;
  hasStripeSubscription: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const disableAll = busy !== null;

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
      {billingUiTier === "essential" ? (
        <p className="text-sm text-zinc-600">
          Need team features? Upgrade to Professional anytime.
        </p>
      ) : null}
      {billingUiTier === "professional" ? (
        <p className="text-xs text-zinc-500">
          Manage plan in billing portal to change or downgrade your plan.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {billingUiTier === "professional" ? (
          <>
            <button
              type="button"
              onClick={() => void goPortal()}
              disabled={disableAll}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
            >
              {busy === "portal" ? "Opening..." : "Manage billing"}
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-500"
            >
              Current plan
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => billingUiTier !== "essential" && void goCheckout("essential", "essential")}
              disabled={disableAll || billingUiTier === "essential"}
              className={
                billingUiTier === "essential"
                  ? "cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-500"
                  : "rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
              }
            >
              {busy === "essential"
                ? "Opening..."
                : billingUiTier === "essential"
                  ? "Current plan"
                  : "Choose Essential — $29/mo"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (billingUiTier === "essential") void goUpgradeProfessional();
                else void goCheckout("professional", "professional");
              }}
              disabled={disableAll}
              className="rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-60"
            >
              {busy === "professional"
                ? "Opening..."
                : busy === "upgrade-prof"
                  ? "Upgrading..."
                  : billingUiTier === "essential"
                    ? upgradeProfessionalLabel
                    : "Choose Professional — $49/mo"}
            </button>
            <button
              type="button"
              onClick={() => void goPortal()}
              disabled={disableAll}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
            >
              {busy === "portal" ? "Opening..." : "Manage billing"}
            </button>
          </>
        )}
      </div>
      {hasStripeSubscription ? (
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
      ) : null}
      <p className="text-xs text-zinc-600">
        Founder pricing is locked in for early subscribers.
      </p>
      <p className="text-xs text-zinc-500">
        Essential — $39/month regular · Professional — $59/month regular
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
        <p className="text-sm font-medium text-zinc-900">Stripe connected</p>
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
