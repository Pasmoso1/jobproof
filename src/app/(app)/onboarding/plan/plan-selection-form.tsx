"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BillingPlanTier, BillingPricingVersion } from "@/lib/stripe";
import { getPlanDisplayLines } from "@/lib/billing-plan-display";
import {
  formatActiveJobLimit,
  formatPlanStorage,
} from "@/lib/plan-limits";
import { selectOnboardingPlan } from "./actions";

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2 text-sm text-zinc-700">
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

export function PlanSelectionForm({ pricingVersion }: { pricingVersion: BillingPricingVersion }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<BillingPlanTier | null>(null);

  const soloPricing = getPlanDisplayLines("essential", pricingVersion);
  const proPricing = getPlanDisplayLines("professional", pricingVersion);

  async function choose(planTier: BillingPlanTier) {
    setError(null);
    setLoading(planTier);
    try {
      const result = await selectOnboardingPlan(planTier);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(result.redirectTo);
      router.refresh();
    } catch {
      setError("Could not save your plan. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-[#2436BB]/20 bg-[#2436BB]/5 px-4 py-3 text-sm text-zinc-700">
        <p className="font-medium text-zinc-900">
          Choose Solo or Pro for your free trial.
        </p>
        <p className="mt-1">
          No credit card required. Your 14-day trial starts after you finish setup. You&apos;ll
          evaluate the plan you pick here.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void choose("essential")}
          className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-[#2436BB]/40 hover:shadow-md disabled:opacity-60"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-lg font-semibold text-zinc-900">Solo</span>
              <p className="mt-1 text-sm font-medium text-zinc-700">Best for independent contractors</p>
            </div>
            <span className="shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800">
              {soloPricing.afterTrialLine}
            </span>
          </div>

          <FeatureList
            items={[
              `${formatActiveJobLimit("essential")} active jobs`,
              `${formatPlanStorage("essential")} secure storage`,
              "Quote requests & proposals",
              "Site visit notes",
              "Customer records",
              "Contracts & change orders",
            ]}
          />

          <span className="mt-auto pt-4 text-sm font-semibold text-[#2436BB]">
            {loading === "essential" ? "Saving…" : "Start with Solo"}
          </span>
        </button>

        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void choose("professional")}
          className="flex flex-col rounded-xl border-2 border-[#2436BB] bg-white p-5 text-left shadow-sm transition hover:shadow-md disabled:opacity-60"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-lg font-semibold text-zinc-900">Pro</span>
              <p className="mt-1 text-sm font-medium text-zinc-700">Best for growing contractors</p>
            </div>
            <span className="shrink-0 rounded-full border border-[#2436BB]/25 bg-[#2436BB]/5 px-2.5 py-1 text-xs font-semibold text-zinc-800">
              {proPricing.afterTrialLine}
            </span>
          </div>

          <FeatureList
            items={[
              "Everything in Solo",
              `${formatActiveJobLimit("professional")} active jobs`,
              `${formatPlanStorage("professional")} secure storage`,
              "Multiple trades",
              "Priority support",
              "First access to new tools",
            ]}
          />

          <span className="mt-auto pt-4 text-sm font-semibold text-[#2436BB]">
            {loading === "professional" ? "Saving…" : "Start with Pro"}
          </span>
        </button>
      </div>

      <p className="text-sm text-zinc-600">
        14-day free trial. No credit card required. Billing only starts if you subscribe after the
        trial.
      </p>
    </div>
  );
}
