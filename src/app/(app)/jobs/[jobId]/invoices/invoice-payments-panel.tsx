"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteLastInvoicePayment,
  type InvoicePaymentDetailRow,
} from "@/app/(app)/actions";
import {
  buildInvoicePaymentTimelineLines,
  contractorInvoicePaymentStatusLabel,
} from "@/lib/invoice-payment-display";
import { formatInvoicePaymentMethod } from "@/lib/invoice-payment-method";
import {
  formatLocalDateStringEastern,
} from "@/lib/datetime-eastern";
import { grossBalanceAfterDeposit, roundInvoiceMoney } from "@/lib/invoice-payment-recalc";
import type { LatestInvoiceSummary } from "./invoice-builder-form";
import { EditLastPaymentModal } from "./edit-last-payment-modal";

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoicePaymentsPanel({
  jobId,
  invoice,
  paymentRows,
}: {
  jobId: string;
  invoice: LatestInvoiceSummary;
  paymentRows: InvoicePaymentDetailRow[];
}) {
  const router = useRouter();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const deposit = Number(invoice.deposit_credited ?? 0);
  const total = Number(invoice.total);
  const gross = grossBalanceAfterDeposit(total, deposit);
  const paidTotal = roundInvoiceMoney(Number(invoice.amount_paid_total ?? 0));
  const balance =
    invoice.balance_due != null && invoice.balance_due !== undefined
      ? roundInvoiceMoney(Number(invoice.balance_due))
      : roundInvoiceMoney(gross - paidTotal);

  const lastPayment = paymentRows.length > 0 ? paymentRows[paymentRows.length - 1] : null;

  const otherPaymentsSum = useMemo(() => {
    if (!lastPayment) return 0;
    return roundInvoiceMoney(
      paymentRows.filter((p) => p.id !== lastPayment.id).reduce((s, p) => s + Number(p.amount), 0)
    );
  }, [paymentRows, lastPayment]);

  const maxForLastLine = useMemo(
    () => roundInvoiceMoney(Math.max(0, gross - otherPaymentsSum)),
    [gross, otherPaymentsSum]
  );

  const canCorrect =
    lastPayment &&
    (invoice.status === "sent" ||
      invoice.status === "overdue" ||
      invoice.status === "partially_paid" ||
      invoice.status === "paid");

  const timeline = buildInvoicePaymentTimelineLines({
    sentAt: invoice.sent_at,
    payments: paymentRows,
    balanceDue: balance,
    invoiceStatus: invoice.status,
    paidAt: invoice.paid_at,
  });

  async function handleConfirmDelete() {
    if (!lastPayment) return;
    setDeleteError(null);
    setDeleteBusy(true);
    const result = await deleteLastInvoicePayment(invoice.id);
    setDeleteBusy(false);
    setConfirmDelete(false);
    if (!result.success) {
      setDeleteError(result.error);
      return;
    }
    const p = new URLSearchParams();
    p.set("invNotice", "paymentRecorded");
    router.replace(`/jobs/${jobId}/invoices?${p.toString()}`);
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Payments & balance</h3>
          <p className="text-xs text-zinc-500">
            Totals update from recorded payments (deposit is separate and is not double-counted).
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</p>
          <p className="font-semibold text-zinc-900">
            {contractorInvoicePaymentStatusLabel(invoice.status)}
          </p>
        </div>
      </div>

      <dl className="grid gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-zinc-500">Payments received</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900">${money(paidTotal)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Remaining balance</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-[#2436BB]">${money(balance)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Amount due after deposit</dt>
          <dd className="mt-0.5 tabular-nums text-zinc-700">${money(gross)}</dd>
        </div>
      </dl>

      {timeline.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Timeline</h4>
          <ul className="mt-2 space-y-2 border-l-2 border-zinc-200 pl-4">
            {timeline.map((line) => (
              <li key={line.key} className="relative text-sm text-zinc-800">
                <span className="absolute -left-[calc(0.5rem+2px)] top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-[#2436BB]" />
                <p className="font-medium">{line.title}</p>
                {line.detail ? <p className="mt-0.5 text-zinc-600">{line.detail}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Payment history</h4>
        {paymentRows.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No payments recorded yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {paymentRows.map((p) => {
              const isLast = lastPayment?.id === p.id;
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium tabular-nums text-zinc-900">
                      ${money(Number(p.amount))}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {formatLocalDateStringEastern(p.paid_on, { dateStyle: "medium" })} ·{" "}
                      {formatInvoicePaymentMethod(p.payment_method)}
                      {p.note?.trim() ? ` · ${p.note.trim()}` : ""}
                    </p>
                  </div>
                  {isLast && canCorrect && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditOpen(true)}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmDelete(true);
                        }}
                        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canCorrect && (
        <p className="text-xs text-zinc-500">
          To fix an older entry, adjust or remove the latest payment first, then re-record payments in
          order if needed.
        </p>
      )}

      {deleteError && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{deleteError}</div>
      )}

      {confirmDelete && lastPayment && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="del-pay-title"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg">
            <h2 id="del-pay-title" className="text-lg font-semibold text-zinc-900">
              Remove latest payment?
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              This removes the most recent payment (${money(Number(lastPayment.amount))} on{" "}
              {formatLocalDateStringEastern(lastPayment.paid_on, { dateStyle: "medium" })}). Invoice
              totals and status will be recalculated.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void handleConfirmDelete()}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
              >
                {deleteBusy ? "Removing…" : "Remove payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {lastPayment && (
        <EditLastPaymentModal
          jobId={jobId}
          invoiceId={invoice.id}
          payment={lastPayment}
          maxTotalForLastPayment={maxForLastLine}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
