"use client";

import { useState } from "react";
import Link from "next/link";
import { InvoiceReminderButton } from "@/app/(app)/jobs/[jobId]/invoices/invoice-reminder-button";
import { RecordPaymentModal } from "@/app/(app)/jobs/[jobId]/invoices/record-payment-modal";
import { INVOICE_PAYMENT_EPS } from "@/lib/invoice-payment-recalc";

type RemindableStatus = "sent" | "overdue" | "partially_paid";

export function DashboardReceivableRowActions({
  jobId,
  invoiceId,
  status,
  balanceDue,
  contractSigned,
}: {
  jobId: string;
  invoiceId: string;
  status: string;
  balanceDue: number;
  contractSigned: boolean;
}) {
  const [payOpen, setPayOpen] = useState(false);

  const canRemind =
    (status === "sent" || status === "overdue" || status === "partially_paid") &&
    balanceDue > INVOICE_PAYMENT_EPS;

  const canRecord =
    contractSigned &&
    (status === "sent" || status === "overdue" || status === "partially_paid") &&
    balanceDue > INVOICE_PAYMENT_EPS;

  const remindStatus: RemindableStatus | null =
    status === "sent" || status === "overdue" || status === "partially_paid" ? status : null;

  return (
    <div className="mt-3 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      {canRemind && remindStatus ? (
        <InvoiceReminderButton
          jobId={jobId}
          invoiceId={invoiceId}
          invoiceStatus={remindStatus}
          className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-950 transition-colors hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[8.5rem]"
        />
      ) : null}
      {canRecord ? (
        <>
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:w-auto sm:min-w-[8.5rem]"
          >
            Record payment
          </button>
          <RecordPaymentModal
            jobId={jobId}
            invoiceId={invoiceId}
            remainingBalance={balanceDue}
            open={payOpen}
            onClose={() => setPayOpen(false)}
          />
        </>
      ) : null}
      <Link
        href={`/jobs/${jobId}/invoices`}
        className="w-full rounded-lg bg-[#2436BB] px-3 py-2 text-center text-xs font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:w-auto sm:min-w-[8.5rem]"
      >
        View invoice
      </Link>
    </div>
  );
}
