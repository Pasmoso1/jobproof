"use client";

import { useState } from "react";
import {
  createBillingPortalSession,
  createStripeConnectOnboardingLink,
  createSubscriptionCheckoutSession,
} from "./actions";

export function BillingActionButtons({
  connectOnboardingIncomplete,
}: {
  connectOnboardingIncomplete: boolean;
}) {
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
          {busy === "essential" ? "Opening..." : "Choose Essential"}
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
          {busy === "professional" ? "Opening..." : "Choose Professional"}
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => go("connect", () => createStripeConnectOnboardingLink())}
          disabled={busy !== null}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
        >
          {busy === "connect"
            ? "Opening..."
            : connectOnboardingIncomplete
              ? "Continue onboarding"
              : "Connect Stripe"}
        </button>
      </div>
    </div>
  );
}

