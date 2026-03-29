"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createInvoice, resendInvoice } from "@/app/(app)/actions";
import {
  invoiceTaxShortLabel,
  taxRateFromPropertyProvince,
} from "@/lib/invoice-tax";
import { formatLocalDateStringEastern } from "@/lib/datetime-eastern";

type Job = {
  id: string;
  title: string;
  current_contract_total?: number | null;
  original_contract_price?: number | null;
  deposit_amount?: number | null;
  property_province?: string | null;
};

export type LatestInvoiceSummary = {
  id: string;
  invoice_number: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  deposit_credited?: number | null;
  balance_due?: number | null;
  due_date: string | null;
  status: string;
};

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoiceBuilderForm({
  jobId,
  job,
  contractSigned,
  latestInvoice,
}: {
  jobId: string;
  job: Job;
  contractSigned: boolean;
  latestInvoice: LatestInvoiceSummary | null;
}) {
  if (latestInvoice) {
    return (
      <ResendInvoicePanel
        jobId={jobId}
        contractSigned={contractSigned}
        invoice={latestInvoice}
      />
    );
  }

  return (
    <CreateInvoicePanel jobId={jobId} job={job} contractSigned={contractSigned} />
  );
}

function ResendInvoicePanel({
  jobId,
  contractSigned,
  invoice,
}: {
  jobId: string;
  contractSigned: boolean;
  invoice: LatestInvoiceSummary;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dueDisplay = invoice.due_date?.trim()
    ? formatLocalDateStringEastern(invoice.due_date)
    : "—";

  const deposit = Number(invoice.deposit_credited ?? 0);
  const balance =
    invoice.balance_due != null && invoice.balance_due !== undefined
      ? Number(invoice.balance_due)
      : Number(invoice.total) - deposit;

  async function handleResend() {
    setError(null);
    if (!contractSigned) {
      setError("Contract must be signed to work with invoices for this job.");
      return;
    }
    setLoading(true);
    const result = await resendInvoice(invoice.id);
    setLoading(false);

    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }

    if (result && "emailSent" in result) {
      const p = new URLSearchParams();
      if (result.emailSent) {
        p.set("invNotice", "resent");
      } else {
        p.set("invNotice", "failed");
        const detail = (result.emailError ?? "").trim().slice(0, 500);
        if (detail) p.set("invMsg", detail);
      }
      router.replace(`/jobs/${jobId}/invoices?${p.toString()}`);
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          {error.includes("business profile") && (
            <Link
              href="/settings/business"
              className="mt-2 inline-block font-medium text-red-800 underline hover:no-underline"
            >
              Business settings →
            </Link>
          )}
        </div>
      )}

      <h2 className="font-semibold text-zinc-900">Resend invoice</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Email the latest invoice again with the same amounts and due date. To change totals or due
        date, contact support — invoices are locked to agreed contract values.
      </p>

      {!contractSigned && (
        <div
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">Contract must be signed</p>
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
          <span className="text-zinc-600">Subtotal</span>
          <span className="font-medium tabular-nums text-zinc-900">
            ${money(Number(invoice.subtotal))}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3">
          <span className="text-zinc-600">Tax</span>
          <span className="font-medium tabular-nums text-zinc-900">
            ${money(Number(invoice.tax_amount))}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3">
          <span className="font-medium text-zinc-800">Total</span>
          <span className="font-semibold tabular-nums text-zinc-900">
            ${money(Number(invoice.total))}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3">
          <span className="text-zinc-600">Deposit received</span>
          <span className="font-medium tabular-nums text-zinc-900">${money(deposit)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3">
          <span className="font-semibold text-zinc-900">Balance due</span>
          <span className="font-bold tabular-nums text-[#2436BB]">${money(balance)}</span>
        </div>
        <div className="border-t border-zinc-200 pt-3 text-zinc-600">
          <span className="text-zinc-500">Due date</span>
          <p className="mt-0.5 font-medium text-zinc-900">{dueDisplay}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleResend}
        disabled={loading || !contractSigned}
        className="mt-6 rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1c2a96] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Sending…" : "Resend invoice"}
      </button>
    </div>
  );
}

function CreateInvoicePanel({
  jobId,
  job,
  contractSigned,
}: {
  jobId: string;
  job: Job;
  contractSigned: boolean;
}) {
  const router = useRouter();
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const agreedSubtotal = Number(
    job.current_contract_total ?? job.original_contract_price ?? 0
  );
  const depositOnFile = Math.max(
    0,
    Number.isFinite(Number(job.deposit_amount)) ? Number(job.deposit_amount) : 0
  );

  const taxRate = taxRateFromPropertyProvince(job.property_province ?? null);
  const taxShort = invoiceTaxShortLabel(job.property_province ?? null);

  const preview = useMemo(() => {
    const sub = agreedSubtotal;
    const tax = Math.round(sub * taxRate * 100) / 100;
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

  const showDepositOnFileNote =
    depositOnFile > 0 && Math.abs(depositOnFile - preview.depositCredited) > 0.005;

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
    if (!dueDate.trim()) {
      setError("Due date is required.");
      return;
    }

    setLoading(true);
    const result = await createInvoice(jobId, dueDate.trim(), notes.trim() || undefined);
    setLoading(false);

    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }

    if (result && "invoiceId" in result) {
      const p = new URLSearchParams();
      if (result.emailSent) {
        p.set("invNotice", "sent");
      } else {
        p.set("invNotice", "draft");
        if (result.emailError) {
          p.set("invMsg", result.emailError.slice(0, 500));
        }
      }
      router.replace(`/jobs/${jobId}/invoices?${p.toString()}`);
      router.refresh();
    }
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
          <span className="text-zinc-600">Subtotal</span>
          <span className="font-medium tabular-nums text-zinc-900">
            ${money(preview.subtotal)}
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          Agreed work from signed contract and change orders (before tax).
        </p>

        <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3">
          <span className="text-zinc-600">Tax ({taxShort})</span>
          <span className="font-medium tabular-nums text-zinc-900">
            ${money(preview.taxAmount)}
          </span>
        </div>

        <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3">
          <span className="font-medium text-zinc-800">Total</span>
          <span className="font-semibold tabular-nums text-zinc-900">
            ${money(preview.total)}
          </span>
        </div>

        <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3">
          <span className="text-zinc-600">Deposit received</span>
          <span className="font-medium tabular-nums text-zinc-900">
            ${money(preview.depositCredited)}
          </span>
        </div>
        {showDepositOnFileNote && (
          <p className="text-xs text-zinc-500">
            Deposit recorded on the job is ${money(depositOnFile)}; only $
            {money(preview.depositCredited)} can apply to this invoice (cannot exceed total).
          </p>
        )}

        <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3">
          <span className="font-semibold text-zinc-900">Balance due</span>
          <span className="font-bold tabular-nums text-[#2436BB]">
            ${money(preview.balanceDue)}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor="dueDate" className="block text-sm font-medium text-zinc-700">
          Due date <span className="text-red-500">*</span>
        </label>
        <input
          id="dueDate"
          type="date"
          required
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mt-1 block w-full max-w-xs rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
        />
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
        {loading ? "Creating…" : "Create and send invoice"}
      </button>
    </form>
  );
}
