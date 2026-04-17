import { getTodayYmdEastern } from "@/lib/datetime-eastern";
import { INVOICE_PAYMENT_EPS, roundInvoiceMoney } from "@/lib/invoice-payment-recalc";
export type ReceivableInvoiceRow = {
  invoiceId: string;
  jobId: string;
  jobTitle: string;
  customerName: string;
  contractSigned: boolean;
  status: string;
  balanceDue: number;
  amountPaidTotal: number | null;
  dueDate: string | null;
  sentAt: string | null;
  paidAt: string | null;
  lastPaymentAt: string | null;
  viewedAt: string | null;
};

type ReceivableJobJoin = {
  title: string | null;
  contract_status?: string | null;
  customers:
    | { full_name?: string | null }
    | { full_name?: string | null }[]
    | null;
};

export type ReceivableInvoiceInput = {
  id: string;
  job_id: string;
  status: string;
  sent_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  viewed_at: string | null;
  balance_due: number | null;
  amount_paid_total: number | null;
  last_payment_at: string | null;
  jobs: ReceivableJobJoin | ReceivableJobJoin[] | null;
};

export type ReceivablesDashboardComputed = {
  totalOutstanding: number;
  overdueAmount: number;
  partiallyPaidAmount: number;
  paidThisMonth: number;
  overdueRows: ReceivableInvoiceRow[];
  partiallyPaidRows: ReceivableInvoiceRow[];
  recentlySentRows: ReceivableInvoiceRow[];
  recentlyPaidRows: ReceivableInvoiceRow[];
  hasAnyInvoice: boolean;
  /** True when total outstanding (sent / overdue / partially paid with balance) is positive. */
  hasOutstandingReceivables: boolean;
};

const OUTSTANDING_STATUSES = new Set(["sent", "overdue", "partially_paid"]);

export function balanceRemainingFromRow(balanceDue: number | null): number {
  if (balanceDue == null || !Number.isFinite(Number(balanceDue))) return 0;
  return Math.max(0, roundInvoiceMoney(Number(balanceDue)));
}

export function invoiceCountsTowardOutstanding(status: string, balance: number): boolean {
  return OUTSTANDING_STATUSES.has(status) && balance > INVOICE_PAYMENT_EPS;
}

/**
 * AR/dashboard overdue: past calendar due date in Eastern time, balance still owed,
 * and invoice is still out for payment (sent / overdue / partially_paid).
 * Independent of stored `overdue` status so partially paid + past due is included.
 */
export function isReceivableArOverdue(row: ReceivableInvoiceRow, todayYmd?: string): boolean {
  const today = (todayYmd ?? getTodayYmdEastern()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  if (!OUTSTANDING_STATUSES.has(row.status)) return false;
  if (row.balanceDue <= INVOICE_PAYMENT_EPS) return false;
  const due = row.dueDate?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  return due < today;
}

export function normalizeReceivableRow(r: ReceivableInvoiceInput): ReceivableInvoiceRow {
  const jobRaw = r.jobs;
  const job = Array.isArray(jobRaw) ? jobRaw[0] : jobRaw;
  const title = job?.title?.trim() || "Untitled job";
  const custRaw = job?.customers;
  const cust = Array.isArray(custRaw) ? custRaw[0] : custRaw;
  const customerName = cust?.full_name?.trim() || "Unknown customer";
  const contractSigned = String(job?.contract_status ?? "") === "signed";
  const balanceDue = balanceRemainingFromRow(
    r.balance_due != null && r.balance_due !== undefined ? Number(r.balance_due) : null
  );
  const apt =
    r.amount_paid_total != null && r.amount_paid_total !== undefined
      ? roundInvoiceMoney(Number(r.amount_paid_total))
      : null;

  return {
    invoiceId: r.id,
    jobId: r.job_id,
    jobTitle: title,
    customerName,
    contractSigned,
    status: String(r.status ?? ""),
    balanceDue,
    amountPaidTotal: apt,
    dueDate: r.due_date?.trim() ? r.due_date : null,
    sentAt: r.sent_at?.trim() ? r.sent_at : null,
    paidAt: r.paid_at?.trim() ? r.paid_at : null,
    lastPaymentAt: r.last_payment_at?.trim() ? r.last_payment_at : null,
    viewedAt: r.viewed_at?.trim() ? r.viewed_at : null,
  };
}

function cmpStr(a: string | null, b: string | null, asc: boolean): number {
  const sa = a ?? "\xff";
  const sb = b ?? "\xff";
  const c = asc ? sa.localeCompare(sb) : sb.localeCompare(sa);
  return c;
}

export function computeReceivablesDashboard(
  rows: ReceivableInvoiceInput[],
  paidThisMonth: number,
  opts?: {
    overdueCap?: number;
    partialCap?: number;
    recentSentCap?: number;
    recentPaidCap?: number;
    /** Eastern `YYYY-MM-DD` for overdue comparisons (defaults to now). */
    todayYmd?: string;
  }
): ReceivablesDashboardComputed {
  const overdueCap = opts?.overdueCap ?? 8;
  const partialCap = opts?.partialCap ?? 8;
  const recentSentCap = opts?.recentSentCap ?? 5;
  const recentPaidCap = opts?.recentPaidCap ?? 5;
  const todayYmd = opts?.todayYmd;

  const normalized = rows.map(normalizeReceivableRow);
  const hasAnyInvoice = normalized.length > 0;

  let totalOutstanding = 0;
  let overdueAmount = 0;
  let partiallyPaidAmount = 0;

  for (const r of normalized) {
    const b = r.balanceDue;
    if (invoiceCountsTowardOutstanding(r.status, b)) {
      totalOutstanding = roundInvoiceMoney(totalOutstanding + b);
    }
    if (isReceivableArOverdue(r, todayYmd)) {
      overdueAmount = roundInvoiceMoney(overdueAmount + b);
    }
    if (
      r.status === "partially_paid" &&
      b > INVOICE_PAYMENT_EPS &&
      !isReceivableArOverdue(r, todayYmd)
    ) {
      partiallyPaidAmount = roundInvoiceMoney(partiallyPaidAmount + b);
    }
  }

  const overdueRows = normalized
    .filter((r) => isReceivableArOverdue(r, todayYmd))
    .sort((a, b) => {
      const d = cmpStr(a.dueDate, b.dueDate, true);
      if (d !== 0) return d;
      return cmpStr(a.sentAt, b.sentAt, true);
    })
    .slice(0, overdueCap);

  const partiallyPaidRows = normalized
    .filter(
      (r) =>
        r.status === "partially_paid" &&
        r.balanceDue > INVOICE_PAYMENT_EPS &&
        !isReceivableArOverdue(r, todayYmd)
    )
    .sort((a, b) => cmpStr(a.lastPaymentAt ?? a.sentAt, b.lastPaymentAt ?? b.sentAt, false))
    .slice(0, partialCap);

  const recentlySentRows = normalized
    .filter(
      (r) =>
        r.status === "sent" &&
        r.balanceDue > INVOICE_PAYMENT_EPS &&
        Boolean(r.sentAt?.trim()) &&
        !isReceivableArOverdue(r, todayYmd)
    )
    .sort((a, b) => cmpStr(a.sentAt, b.sentAt, false))
    .slice(0, recentSentCap);

  const recentlyPaidRows = normalized
    .filter((r) => r.status === "paid")
    .sort((a, b) => {
      const d = cmpStr(a.paidAt ?? a.lastPaymentAt, b.paidAt ?? b.lastPaymentAt, false);
      if (d !== 0) return d;
      return cmpStr(a.sentAt, b.sentAt, false);
    })
    .slice(0, recentPaidCap);

  const hasOutstandingReceivables = totalOutstanding > INVOICE_PAYMENT_EPS;

  return {
    totalOutstanding,
    overdueAmount,
    partiallyPaidAmount,
    paidThisMonth: roundInvoiceMoney(Math.max(0, paidThisMonth)),
    overdueRows,
    partiallyPaidRows,
    recentlySentRows,
    recentlyPaidRows,
    hasAnyInvoice,
    hasOutstandingReceivables,
  };
}

