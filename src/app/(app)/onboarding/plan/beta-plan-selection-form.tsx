"use client";

import { useState } from "react";
import type { BillingPlanTier } from "@/lib/stripe";
import { selectBetaPlan } from "./actions";

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
    <div className="space-y-8">
      <div className="rounded-xl border border-[#2436BB]/20 bg-[#2436BB]/5 px-4 py-3 text-sm text-zinc-700">
        <p className="font-medium text-zinc-900">All beta plans are free during testing.</p>
        <p className="mt-1">
          Choose the plan that best matches how you run your business. Your selection helps us build the right version
          of JobProof for contractors like you.
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
              <span className="text-lg font-semibold text-zinc-900">Essential</span>
              <p className="mt-1 text-sm font-medium text-zinc-700">Best for solo contractors</p>
            </div>
            <span className="shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600">
              normally <span className="line-through">$29/mo</span>
            </span>
          </div>

          <FeatureList
            items={[
              "Up to 10 active jobs",
              "Contracts & signatures",
              "Change orders",
              "Proof photos & timeline",
              "Invoices",
              "Payment tracking",
              "Basic dispute documentation",
            ]}
          />

          <span className="mt-auto pt-4 text-sm font-semibold text-[#2436BB]">
            {loading === "essential" ? "Saving…" : "Choose Essential"}
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
              <span className="text-lg font-semibold text-zinc-900">Professional</span>
              <p className="mt-1 text-sm font-medium text-zinc-700">Best for growing businesses</p>
            </div>
            <span className="shrink-0 rounded-full border border-[#2436BB]/25 bg-[#2436BB]/5 px-2.5 py-1 text-xs font-medium text-zinc-700">
              normally <span className="line-through">$59/mo</span>
            </span>
          </div>

          <FeatureList
            items={[
              "Everything in Essential",
              "Unlimited active jobs",
              "Higher storage limits",
              "Advanced documentation workflows",
              "Priority access to new features",
              "Future team features",
            ]}
          />

          <span className="mt-auto pt-4 text-sm font-semibold text-[#2436BB]">
            {loading === "professional" ? "Saving…" : "Choose Professional"}
          </span>
        </button>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Compare plans</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Quick overview of the key differences between Essential and Professional.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium text-zinc-700">
                  Feature
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-zinc-700">
                  Essential
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-zinc-700">
                  Professional
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {[
                ["Active jobs", "10", "Unlimited"],
                ["Contracts", "✓", "✓"],
                ["Change orders", "✓", "✓"],
                ["Proof photos", "✓", "✓"],
                ["Invoices", "✓", "✓"],
                ["Payment tracking", "✓", "✓"],
                ["Storage", "Standard", "Higher"],
                ["Future team features", "—", "✓"],
                ["Early feature access", "—", "✓"],
              ].map(([feature, essential, professional]) => (
                <tr key={feature}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{feature}</td>
                  <td className="px-4 py-3 text-zinc-700">{essential}</td>
                  <td className="px-4 py-3 text-zinc-700">{professional}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-zinc-600">
          Both plans are free during beta testing. Choose the plan you would realistically use after launch.
        </p>
      </section>
    </div>
  );
}
