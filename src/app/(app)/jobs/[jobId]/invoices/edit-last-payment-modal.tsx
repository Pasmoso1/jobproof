"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateLastInvoicePayment, type InvoicePaymentDetailRow } from "@/app/(app)/actions";
import {
  INVOICE_PAYMENT_METHOD_OPTIONS,
  type InvoicePaymentMethod,
} from "@/lib/invoice-payment-method";

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function EditLastPaymentModal({
  jobId,
  invoiceId,
  payment,
  maxTotalForLastPayment,
  open,
  onClose,
}: {
  jobId: string;
  invoiceId: string;
  payment: InvoicePaymentDetailRow;
  /** Other payments' sum + this row must not exceed gross after deposit. */
  maxTotalForLastPayment: number;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(payment.paid_on);
  const [method, setMethod] = useState<InvoicePaymentMethod>(
    (payment.payment_method as InvoicePaymentMethod) || "other"
  );
  const [note, setNote] = useState(payment.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(String(payment.amount));
    setPaidOn(payment.paid_on);
    setMethod((payment.payment_method as InvoicePaymentMethod) || "other");
    setNote(payment.note ?? "");
    setError(null);
  }, [open, payment]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const raw = amount.trim();
    const parsed = Number.parseFloat(raw.replace(/,/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid payment amount greater than zero.");
      return;
    }
    const paidOnTrim = paidOn.trim();
    if (!paidOnTrim) {
      setError("Payment date is required.");
      return;
    }
    if (parsed > maxTotalForLastPayment + 0.0001) {
      setError(
        `Amount is too high for the remaining allowance on this invoice (max $${money(maxTotalForLastPayment)} for this entry).`
      );
      return;
    }

    setLoading(true);
    const result = await updateLastInvoicePayment(
      invoiceId,
      parsed,
      paidOnTrim,
      method,
      note.trim() || undefined
    );
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    const p = new URLSearchParams();
    p.set("invNotice", "paymentRecorded");
    router.replace(`/jobs/${jobId}/invoices?${p.toString()}`);
    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-payment-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-5 sm:p-6">
          <h2 id="edit-payment-title" className="text-lg font-semibold text-zinc-900">
            Edit latest payment
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Only the most recent payment can be changed. Maximum for this line:{" "}
            <span className="font-semibold tabular-nums text-zinc-900">
              ${money(maxTotalForLastPayment)}
            </span>
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}

          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="editPayAmount" className="block text-sm font-medium text-zinc-700">
                Amount received <span className="text-red-500">*</span>
              </label>
              <input
                id="editPayAmount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                required
              />
            </div>
            <div>
              <label htmlFor="editPayDate" className="block text-sm font-medium text-zinc-700">
                Payment date <span className="text-red-500">*</span>
              </label>
              <input
                id="editPayDate"
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
                className="mt-1 block w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                required
              />
            </div>
            <div>
              <label htmlFor="editPayMethod" className="block text-sm font-medium text-zinc-700">
                Payment method <span className="text-red-500">*</span>
              </label>
              <select
                id="editPayMethod"
                value={method}
                onChange={(e) => setMethod(e.target.value as InvoicePaymentMethod)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              >
                {INVOICE_PAYMENT_METHOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="editPayNote" className="block text-sm font-medium text-zinc-700">
                Note (optional)
              </label>
              <textarea
                id="editPayNote"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-60"
            >
              {loading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
