import Link from "next/link";
import { formatDateEastern, formatLocalDateStringEastern } from "@/lib/datetime-eastern";
import {
  invoiceCustomerViewSecondaryLine,
  invoiceStatusesWhereCustomerViewApplies,
} from "@/lib/invoice-viewed-display";
import { shouldShowCustomerMayHavePaidWarning } from "@/lib/invoice-reminder-automation";
import type { ReceivableInvoiceRow, ReceivablesDashboardComputed } from "@/lib/receivables-dashboard";
import { DashboardReceivableRowActions } from "./dashboard-receivable-row-actions";

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusLabel(status: string): string {
  switch (status) {
    case "partially_paid":
      return "Partially paid";
    case "overdue":
      return "Overdue";
    case "sent":
      return "Sent";
    case "paid":
      return "Paid";
    case "draft":
      return "Draft";
    default:
      return status;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "overdue":
      return "bg-red-100 text-red-900 ring-1 ring-red-200";
    case "partially_paid":
      return "bg-amber-50 text-amber-950 ring-1 ring-amber-200";
    case "sent":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
    case "paid":
      return "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
  }
}

function ReceivableSubsection({
  title,
  description,
  rows,
  dateKind,
  arOverdueList,
}: {
  title: string;
  description?: string;
  rows: ReceivableInvoiceRow[];
  dateKind: "due" | "sent" | "paid";
  /** When true, rows are shown as AR-overdue (due date + balance), with extra hint if still partially_paid in DB. */
  arOverdueList?: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="border-t border-zinc-100 pt-5 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {description ? <p className="text-xs text-zinc-500">{description}</p> : null}
      </div>
      <ul className="mt-3 space-y-3">
        {rows.map((r) => {
          const dateLine =
            dateKind === "due" && r.dueDate
              ? `Due ${formatLocalDateStringEastern(r.dueDate, { dateStyle: "medium" })}`
              : dateKind === "sent" && r.sentAt
                ? `Sent ${formatDateEastern(r.sentAt, { dateStyle: "medium" })}`
                : dateKind === "paid" && (r.paidAt || r.lastPaymentAt)
                  ? `Paid ${formatDateEastern(r.paidAt ?? r.lastPaymentAt ?? "", { dateStyle: "medium" })}`
                  : r.dueDate
                    ? `Due ${formatLocalDateStringEastern(r.dueDate, { dateStyle: "medium" })}`
                    : null;

          const viewedLine = invoiceCustomerViewSecondaryLine({
            viewedAt: r.viewedAt,
            showNotYetViewed: invoiceStatusesWhereCustomerViewApplies(r.status),
            invoiceStatus: r.status,
          });

          const mayHavePaid =
            (r.status === "sent" || r.status === "overdue" || r.status === "partially_paid") &&
            shouldShowCustomerMayHavePaidWarning({
              viewed_at: r.viewedAt,
              balance_due: r.balanceDue,
              amount_paid_total: r.amountPaidTotal,
              status: r.status,
            });

          return (
            <li
              key={r.invoiceId}
              className="rounded-lg border border-zinc-200 bg-zinc-50/40 p-3 sm:p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium text-zinc-900">{r.jobTitle}</p>
                  <p className="text-sm text-zinc-600">{r.customerName}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {arOverdueList ? (
                      <>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass("overdue")}`}
                        >
                          Overdue
                        </span>
                        {r.status === "partially_paid" ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass("partially_paid")}`}
                          >
                            Partially paid
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(r.status)}`}
                      >
                        {statusLabel(r.status)}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-zinc-900">
                      {r.status === "paid" ? "Paid in full" : `$${money(r.balanceDue)} remaining`}
                    </span>
                  </div>
                  {dateLine ? <p className="text-xs text-zinc-600">{dateLine}</p> : null}
                  {viewedLine ? <p className="text-xs text-zinc-500">{viewedLine}</p> : null}
                  {mayHavePaid ? (
                    <p className="text-xs text-amber-800">Customer may have paid — confirm before reminding.</p>
                  ) : null}
                </div>
                <DashboardReceivableRowActions
                  jobId={r.jobId}
                  invoiceId={r.invoiceId}
                  status={r.status}
                  balanceDue={r.balanceDue}
                  contractSigned={r.contractSigned}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MoneyOverviewSection({
  data,
}: {
  data: ReceivablesDashboardComputed;
}) {
  const {
    totalOutstanding,
    overdueAmount,
    partiallyPaidAmount,
    paidThisMonth,
    overdueRows,
    partiallyPaidRows,
    recentlySentRows,
    recentlyPaidRows,
    hasAnyInvoice,
    hasOutstandingReceivables,
  } = data;

  const showReceivableLists =
    overdueRows.length > 0 ||
    partiallyPaidRows.length > 0 ||
    recentlySentRows.length > 0 ||
    recentlyPaidRows.length > 0;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white" aria-labelledby="money-overview-heading">
      <div className="border-b border-zinc-200 px-4 py-4 sm:px-6">
        <h2 id="money-overview-heading" className="text-lg font-semibold text-zinc-900">
          Money overview
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Receivables and payments use your invoice balances and recorded payments (Eastern time for monthly totals).
        </p>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-6 xl:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total outstanding</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">${money(totalOutstanding)}</p>
          <p className="mt-1 text-xs text-zinc-500">Sent, overdue, and partially paid with balance due</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Overdue</p>
          <p className="mt-1 text-xl font-semibold text-red-800">${money(overdueAmount)}</p>
          <p className="mt-1 text-xs text-zinc-500">Past due (Eastern), balance remaining</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Partially paid</p>
          <p className="mt-1 text-xl font-semibold text-amber-950">${money(partiallyPaidAmount)}</p>
          <p className="mt-1 text-xs text-zinc-500">Partial payments not past due (or no due date)</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Paid this month</p>
          <p className="mt-1 text-xl font-semibold text-emerald-900">${money(paidThisMonth)}</p>
          <p className="mt-1 text-xs text-zinc-500">Payments recorded this month (Toronto)</p>
        </div>
      </div>

      {!hasAnyInvoice ? (
        <div className="border-t border-zinc-100 px-4 py-10 text-center text-sm text-zinc-600 sm:px-6">
          No invoices yet. When you send invoices, balances and follow-ups will appear here.
        </div>
      ) : !hasOutstandingReceivables && !showReceivableLists ? (
        <div className="border-t border-zinc-100 px-4 py-10 text-center text-sm text-zinc-600 sm:px-6">
          Nothing outstanding right now. Draft invoices are not counted until they are sent.
        </div>
      ) : showReceivableLists ? (
        <div className="space-y-2 border-t border-zinc-100 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">Follow-up and recent activity</h3>
            <Link
              href="#dashboard-job-list"
              className="text-xs font-medium text-[#2436BB] underline decoration-[#2436BB]/30 underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
            >
              More in jobs list below →
            </Link>
          </div>

          <ReceivableSubsection
            title="Overdue invoices"
            rows={overdueRows}
            dateKind="due"
            arOverdueList
          />
          <ReceivableSubsection title="Partially paid" rows={partiallyPaidRows} dateKind="due" />
          <ReceivableSubsection
            title="Recently sent (open)"
            description="Awaiting payment"
            rows={recentlySentRows}
            dateKind="sent"
          />
          <ReceivableSubsection title="Recently paid" rows={recentlyPaidRows} dateKind="paid" />
        </div>
      ) : null}
    </section>
  );
}
