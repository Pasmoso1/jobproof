"use client";

import { useState } from "react";
import type { BillingPlanTier } from "@/lib/stripe";
import { selectBetaPlan } from "./actions";

export function BetaPlanSelectionForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<BillingPlanTier | null>(null);

  async function choose(planTier: BillingPlanTier) {
    setError(null);
    setLoading(planTier);
    try {
      const result = await selectBetaPlan(planTier);
      if (result && "success" in result && !result.success) {
        setError(result.error);
      }
    } catch {
      /* redirect on success */
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-[#2436BB]/20 bg-[#2436BB]/5 px-4 py-3 text-sm text-zinc-700">
        Beta testers receive full access free during testing.
      </p>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void choose("essential")}
          className="flex min-h-[180px] flex-col rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-[#2436BB]/40 hover:shadow-md disabled:opacity-60"
        >
          <span className="text-lg font-semibold text-zinc-900">Essential</span>
          <span className="mt-1 text-sm text-zinc-500 line-through">normally $29/month</span>
          <span className="mt-3 text-sm text-zinc-600">
            Core job protection, proof timeline, contracts, and invoices.
          </span>
          <span className="mt-auto pt-4 text-sm font-semibold text-[#2436BB]">
            {loading === "essential" ? "Saving…" : "Choose Essential"}
          </span>
        </button>

        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void choose("professional")}
          className="flex min-h-[180px] flex-col rounded-xl border-2 border-[#2436BB] bg-white p-5 text-left shadow-sm transition hover:shadow-md disabled:opacity-60"
        >
          <span className="text-lg font-semibold text-zinc-900">Professional</span>
          <span className="mt-1 text-sm text-zinc-500 line-through">normally $59/month</span>
          <span className="mt-3 text-sm text-zinc-600">
            Everything in Essential plus higher limits and advanced workflows.
          </span>
          <span className="mt-auto pt-4 text-sm font-semibold text-[#2436BB]">
            {loading === "professional" ? "Saving…" : "Choose Professional"}
          </span>
        </button>
      </div>
    </div>
  );
}
