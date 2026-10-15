"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BillingPlanTier, BillingPricingVersion } from "@/lib/stripe";
import { getPlanDisplayLines } from "@/lib/billing-plan-display";
import {
  formatActiveJobLimit,
  formatPlanStorage,
} from "@/lib/plan-limits";
import { GA4_FUNNEL_EVENTS, trackGa4Event } from "@/lib/ga4";
import { selectOnboardingPlan } from "./actions";

const PLAN_SAVE_ERROR = "Could not save your plan. Please check your connection and try again.";

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-1.5 text-sm text-zinc-700">
      {items.map((item) => (
        <li key={item} className="flex gap-2 leading-snug">
          <span className="mt-[1px] select-none text-[#2436BB]" aria-hidden="true">
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden="true"
    />
  );
}

export function PlanSelectionForm({
  pricingVersion,
  selectedTier = null,
}: {
  pricingVersion: BillingPricingVersion;
  selectedTier?: BillingPlanTier | null;
}) {
  const router = useRouter();
  // Shown under the tapped plan so it stays on screen on phones where Pro sits below the fold.
  const [error, setError] = useState<{ tier: BillingPlanTier; message: string } | null>(null);
  // Not cleared on success: the form stays locked until the next step replaces this page.
  const [savingTier, setSavingTier] = useState<BillingPlanTier | null>(null);
  const [isNavigating, startTransition] = useTransition();
  const inFlight = useRef(false);
  const busy = savingTier !== null || isNavigating;

  const soloPricing = getPlanDisplayLines("essential", pricingVersion);
  const proPricing = getPlanDisplayLines("professional", pricingVersion);

  async function choose(planTier: BillingPlanTier) {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setSavingTier(planTier);
    let result: Awaited<ReturnType<typeof selectOnboardingPlan>>;
    try {
      result = await selectOnboardingPlan(planTier);
    } catch {
      inFlight.current = false;
      setSavingTier(null);
      setError({ tier: planTier, message: PLAN_SAVE_ERROR });
      return;
    }
    if (!result.success) {
      inFlight.current = false;
      setSavingTier(null);
      setError({ tier: planTier, message: result.error });
      return;
    }
    trackGa4Event(GA4_FUNNEL_EVENTS.onboarding_plan_selected, { plan_tier: planTier });
    startTransition(() => {
      router.push(result.redirectTo);
    });
  }

  const plans: Array<{
    tier: BillingPlanTier;
    name: string;
    audience: string;
    price: string;
    features: string[];
    featured: boolean;
  }> = [
    {
      tier: "essential",
      name: "Solo",
      audience: "Best for independent contractors",
      price: soloPricing.afterTrialLine,
      features: [
        `${formatActiveJobLimit("essential")} active jobs`,
        `${formatPlanStorage("essential")} secure storage`,
        "Quote requests & proposals",
        "Site visit notes",
        "Customer records",
        "Contracts & change orders",
      ],
      featured: false,
    },
    {
      tier: "professional",
      name: "Pro",
      audience: "Best for growing contractors",
      price: proPricing.afterTrialLine,
      features: [
        "Everything in Solo",
        `${formatActiveJobLimit("professional")} active jobs`,
        `${formatPlanStorage("professional")} secure storage`,
        "Multiple trades",
        "Priority support",
        "First access to new tools",
      ],
      featured: true,
    },
  ];

  return (
    <div className="space-y-4" aria-busy={busy}>

      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => {
          const saving = savingTier === plan.tier;
          const current = selectedTier === plan.tier;
          return (
            <div
              key={plan.tier}
              className={`flex flex-col rounded-xl bg-white p-4 shadow-sm sm:p-5 ${
                plan.featured ? "border-2 border-[#2436BB]" : "border border-zinc-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">
                    {plan.name}
                    {current ? (
                      <span className="ml-2 align-middle text-xs font-medium text-[#2436BB]">
                        Selected
                      </span>
                    ) : null}
                  </h2>
                  <p className="mt-0.5 text-sm font-medium text-zinc-700">{plan.audience}</p>
                </div>
                <span className="shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800">
                  {plan.price}
                </span>
              </div>

              <FeatureList items={plan.features} />

              <button
                type="button"
                disabled={busy}
                onClick={() => void choose(plan.tier)}
                className={`mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
                  plan.featured
                    ? "bg-[#2436BB] text-white hover:bg-[#1c2a96] disabled:opacity-70"
                    : "border border-[#2436BB] bg-white text-[#2436BB] hover:bg-[#2436BB]/5 disabled:opacity-60"
                }`}
              >
                {saving ? (
                  <>
                    <Spinner />
                    <span>Saving…</span>
                  </>
                ) : (
                  `Continue with ${plan.name}`
                )}
              </button>
              {error?.tier === plan.tier ? (
                <p
                  role="alert"
                  className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
                >
                  {error.message}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-zinc-500" role="status" aria-live="polite">
        {busy ? "Saving your plan…" : "Billing only starts if you subscribe after the trial."}
      </p>
    </div>
  );
}
