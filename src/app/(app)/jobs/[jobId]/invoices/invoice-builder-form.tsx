"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createInvoice } from "@/app/(app)/actions";

type Job = {
  id: string;
  title: string;
  current_contract_total?: number | null;
  original_contract_price?: number | null;
  deposit_amount?: number | null;
  tax_rate?: number;
};

export function InvoiceBuilderForm({
  jobId,
  job,
  contractSigned,
}: {
  jobId: string;
  job: Job;
  contractSigned: boolean;
}) {
  const router = useRouter();
  const [taxRate, setTaxRate] = useState(String(job.tax_rate ?? 0.13));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const agreedSubtotal = Number(
    job.current_contract_total ?? job.original_contract_price ?? 0
  );
  const depositOnFile = Math.max(
    0,
    Number.isFinite(Number(job.deposit_amount))
      ? Number(job.deposit_amount)
      : 0
  );

  const preview = useMemo(() => {
    const rate = parseFloat(taxRate);
    const r = Number.isFinite(rate) && rate >= 0 ? rate : 0;
    const sub = agreedSubtotal;
    const tax = Math.round(sub * r * 100) / 100;
    const total = Math.round((sub + tax) * 100) / 100;
    const depositCredited = Math.min(depositOnFile, total);
    const balanceDue = Math.round((total - depositCredited) * 100) / 100;
    return {
      subtotal: sub,
      taxAmount: tax,
      total,
      depositCredited,
      balanceDue,
    };
  }, [agreedSubtotal, taxRate, depositOnFile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!contractSigned) {
      setError("Sign the contract before creating an invoice from agreed amounts.");
      return;
    }
    if (!Number.isFinite(agreedSubtotal) || agreedSubtotal <= 0) {
      setError("This job does not have a positive agreed work total.");
      return;
    }

    setLoading(true);
    const result = await createInvoice(
      jobId,
      parseFloat(taxRate) || 0,
      dueDate || undefined,
      notes.trim() || undefined
    );
    setLoading(false);

    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  }

  const money = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
        Amounts come from the signed contract and signed change orders on this job. Line totals
        cannot be edited here so the invoice always matches documented agreements.
      </p>

      {!contractSigned && (
        <div
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">Contract must be signed first</p>
          <p className="mt-1 text-amber-900">
            Finish contract signing, then return here to generate an invoice from the agreed total.
          </p>
          <Link
            href={`/jobs/${jobId}/contract`}
            className="mt-2 inline-block font-medium text-amber-950 underline hover:no-underline"
          >
            Go to contract →
          </Link>
        </div>
      )}

      <div className="mt-6 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-600">Subtotal (agreed work, before tax)</span>
          <span className="font-medium tabular-nums text-zinc-900">${money(agreedSubtotal)}</span>
        </div>
        <p className="text-xs text-zinc-500">
          Locked — equals job total from signed contract plus signed change orders.
        </p>

        <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3">
          <span className="text-zinc-600">Tax ({(parseFloat(taxRate) || 0) * 100}%)</span>
          <span className="font-medium tabular-nums text-zinc-900">
            ${money(preview.taxAmount)}
          </span>
        </div>

        <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3">
          <span className="font-medium text-zinc-800">Total (subtotal + tax)</span>
          <span className="font-semibold tabular-nums text-zinc-900">
            ${money(preview.total)}
          </span>
        </div>

        <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3">
          <span className="text-zinc-600">Deposit on file (from job)</span>
          <span className="font-medium tabular-nums text-zinc-900">${money(depositOnFile)}</span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-zinc-600">Deposit credited (applied to this invoice)</span>
          <span className="font-medium tabular-nums text-zinc-900">
            ${money(preview.depositCredited)}
          </span>
        </div>

        <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3">
          <span className="font-semibold text-zinc-900">Balance due</span>
          <span className="font-bold tabular-nums text-[#2436BB]">
            ${money(preview.balanceDue)}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="taxRate" className="block text-sm font-medium text-zinc-700">
            Tax rate (editable)
          </label>
          <input
            id="taxRate"
            type="number"
            step="0.0001"
            min="0"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            className="no-spinner mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Decimal rate (e.g. 0.13 for 13%). Defaults from the job record.
          </p>
        </div>
        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-zinc-700">
            Due date (editable)
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

      <div className="mt-4">
        <label htmlFor="invNotes" className="block text-sm font-medium text-zinc-700">
          Notes to customer (optional)
        </label>
        <textarea
          id="invNotes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Payment instructions, thank-you message, etc."
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !contractSigned}
        className="mt-4 rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1c2a96] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create invoice"}
      </button>
    </form>
  );
}
