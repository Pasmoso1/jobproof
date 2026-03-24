"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createInvoice } from "@/app/(app)/actions";

type Job = {
  id: string;
  title: string;
  current_contract_total?: number | null;
  original_contract_price?: number | null;
  approved_change_total?: number;
  tax_rate?: number;
};

export function InvoiceBuilderForm({ jobId, job }: { jobId: string; job: Job }) {
  const router = useRouter();
  const [lineItems, setLineItems] = useState([{ description: "", amount: "" }]);
  const [taxRate, setTaxRate] = useState(String(job.tax_rate ?? 0.13));
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalPrice = job.current_contract_total ?? job.original_contract_price ?? 0;

  function addLine() {
    setLineItems((prev) => [...prev, { description: "", amount: "" }]);
  }

  function removeLine(i: number) {
    setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: "description" | "amount", value: string) {
    setLineItems((prev) =>
      prev.map((item, idx) =>
        idx === i ? { ...item, [field]: value } : item
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const items = lineItems
      .filter((i) => i.description.trim() && i.amount)
      .map((i) => ({
        description: i.description.trim(),
        amount: parseFloat(i.amount) || 0,
      }));

    if (items.length === 0) {
      setError("Add at least one line item");
      setLoading(false);
      return;
    }

    const result = await createInvoice(
      jobId,
      items,
      parseFloat(taxRate) || 0,
      dueDate || undefined
    );

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          {error.includes("business details") && (
            <Link
              href="/settings/business"
              className="mt-2 inline-block font-medium text-red-800 underline hover:no-underline"
            >
              Add business details →
            </Link>
          )}
        </div>
      )}
      <h2 className="font-semibold text-zinc-900">Create invoice</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Job total: ${Number(totalPrice).toLocaleString()}
      </p>

      <div className="mt-4 space-y-4">
        {lineItems.map((item, i) => (
          <div key={i} className="flex flex-wrap items-start gap-2">
            <input
              type="text"
              value={item.description}
              onChange={(e) => updateLine(i, "description", e.target.value)}
              placeholder="Description"
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
            <div className="relative w-32 shrink-0">
              <span className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-sm text-zinc-500">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={item.amount}
                onChange={(e) => updateLine(i, "amount", e.target.value)}
                placeholder="0.00"
                className="no-spinner w-full rounded-lg border border-zinc-300 py-2.5 pl-6 pr-2 text-right text-sm text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              />
            </div>
            {lineItems.length > 1 && (
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addLine}
          className="text-sm font-medium text-[#2436BB] hover:underline"
        >
          + Add line item
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="taxRate" className="block text-sm font-medium text-zinc-700">
            Tax rate (e.g. 0.13)
          </label>
          <input
            id="taxRate"
            type="number"
            step="0.01"
            min="0"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            className="no-spinner mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
          />
        </div>
        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-zinc-700">
            Due date
          </label>
          <input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1c2a96] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Creating..." : "Create invoice"}
      </button>
    </form>
  );
}
