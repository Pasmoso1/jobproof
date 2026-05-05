"use client";

import { useState } from "react";
import {
  createBillingPortalSession,
  createStripeConnectOnboardingLink,
  createSubscriptionCheckoutSession,
} from "./actions";

export function BillingActionButtons() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(label: string, fn: () => Promise<{ url: string }>) {
    setError(null);
    setBusy(label);
    try {
      const { url } = await fn();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            go("essential", () =>
              createSubscriptionCheckoutSession({ planTier: "essential" })
            )
          }
          disabled={busy !== null}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
        >
          {busy === "essential" ? "Opening..." : "Choose Essential — $29/mo"}
        </button>
        <button
          type="button"
          onClick={() =>
            go("professional", () =>
              createSubscriptionCheckoutSession({ planTier: "professional" })
            )
          }
          disabled={busy !== null}
          className="rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-60"
        >
          {busy === "professional" ? "Opening..." : "Choose Professional — $49/mo"}
        </button>
        <button
          type="button"
          onClick={() => go("portal", () => createBillingPortalSession())}
          disabled={busy !== null}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
        >
          {busy === "portal" ? "Opening..." : "Manage billing"}
        </button>
      </div>
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
      setError(e instanceof Error ? e.message : "Action failed.");
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
