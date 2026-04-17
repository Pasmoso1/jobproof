import { shouldShowCustomerMayHavePaidWarning } from "@/lib/invoice-reminder-automation";
import {
  diffCalendarDaysYmd,
  getTodayYmdEastern,
  isoToYmdEastern,
  formatDateEastern,
  formatDateTimeEastern,
  formatLocalDateStringEastern,
} from "@/lib/datetime-eastern";
import { invoiceStatusesWhereCustomerViewApplies } from "@/lib/invoice-viewed-display";
import { formatInvoicePaymentMethod } from "@/lib/invoice-payment-method";
import {
  computeReceivablesDashboard,
  invoiceCountsTowardOutstanding,
  isReceivableArOverdue,
  normalizeReceivableRow,
  type ReceivableInvoiceInput,
  type ReceivableInvoiceRow,
} from "@/lib/receivables-dashboard";
export type CollectionsQueueKey =
  | "overdue_not_viewed"
  | "overdue_viewed"
  | "partial_on_track"
  | "sent_not_viewed"
  | "sent_on_track";

export type CollectionsRow = ReceivableInvoiceRow & {
  queueKey: CollectionsQueueKey;
  lastReminderSuccessAt: string | null;
  lastReminderSource: "manual" | "automation" | null;
  latestPaymentMethod: string | null;
};

export type CollectionsSummary = {
  totalOutstanding: number;
  overdueAmount: number;
  partiallyPaidAmount: number;
  notViewedOpenCount: number;
  recentlyRemindedOpenCount: number;
};

export type CollectionsCenterPayload = {
  summary: CollectionsSummary;
  /** Open invoices only, each classified into exactly one queue. */
  rows: CollectionsRow[];
  todayYmd: string;
};

/** Stored overdue (even without due date) still counts as overdue for collections queues. */
export function isCollectionsQueueOverdue(row: ReceivableInvoiceRow, todayYmd?: string): boolean {
  if (!invoiceCountsTowardOutstanding(row.status, row.balanceDue)) return false;
  if (isReceivableArOverdue(row, todayYmd)) return true;
  if (row.status === "overdue") return true;
  return false;
}

function isNotViewedForCustomer(row: ReceivableInvoiceRow): boolean {
  if (!invoiceStatusesWhereCustomerViewApplies(row.status)) return false;
  return !row.viewedAt?.trim();
}

export function classifyCollectionsQueue(
  row: ReceivableInvoiceRow,
  todayYmd?: string
): CollectionsQueueKey | null {
  if (!invoiceCountsTowardOutstanding(row.status, row.balanceDue)) return null;
  if (isCollectionsQueueOverdue(row, todayYmd)) {
    return isNotViewedForCustomer(row) ? "overdue_not_viewed" : "overdue_viewed";
  }
  if (row.status === "partially_paid") return "partial_on_track";
  if (row.status === "sent") {
    return isNotViewedForCustomer(row) ? "sent_not_viewed" : "sent_on_track";
  }
  return null;
}

function queueSortOrder(k: CollectionsQueueKey): number {
  switch (k) {
    case "overdue_not_viewed":
      return 0;
    case "overdue_viewed":
      return 1;
    case "partial_on_track":
      return 2;
    case "sent_not_viewed":
      return 3;
    case "sent_on_track":
      return 4;
    default:
      return 99;
  }
}

function compareWithinQueue(a: CollectionsRow, b: CollectionsRow): number {
  const dueA = a.dueDate ?? "\xff";
  const dueB = b.dueDate ?? "\xff";
  const balDiff = b.balanceDue - a.balanceDue;
  switch (a.queueKey) {
    case "partial_on_track": {
      const lp = (b.lastPaymentAt ?? b.sentAt ?? "").localeCompare(a.lastPaymentAt ?? a.sentAt ?? "");
      if (lp !== 0) return lp;
      if (dueA !== dueB) return dueA.localeCompare(dueB);
      return balDiff;
    }
    default: {
      if (dueA !== dueB) return dueA.localeCompare(dueB);
      if (balDiff !== 0) return balDiff;
      return (a.sentAt ?? "").localeCompare(b.sentAt ?? "");
    }
  }
}

export function sortCollectionsRowsForDisplay(rows: CollectionsRow[]): CollectionsRow[] {
  return [...rows].sort((a, b) => {
    const oa = queueSortOrder(a.queueKey);
    const ob = queueSortOrder(b.queueKey);
    if (oa !== ob) return oa - ob;
    return compareWithinQueue(a, b);
  });
}

export function isRecentReminderEastern(
  reminderSuccessIso: string | null,
  todayYmd: string,
  windowDays: number
): boolean {
  if (!reminderSuccessIso?.trim()) return false;
  const remYmd = isoToYmdEastern(reminderSuccessIso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(remYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) return false;
  if (remYmd > todayYmd) return false;
  return diffCalendarDaysYmd(remYmd, todayYmd) <= windowDays;
}

export function reminderSpacingNote(lastReminderSuccessIso: string | null): string | null {
  if (!lastReminderSuccessIso?.trim()) return null;
  const ms = new Date(lastReminderSuccessIso).getTime();
  if (Number.isNaN(ms)) return null;
  const hours = (Date.now() - ms) / 3600000;
  if (hours < 0 || hours > 48) return null;
  return "A reminder went out recently — consider giving the customer a little time before nudging again.";
}

/** Soft “take another look” — not a hard block on reminders. */
export function collectionsRowNeedsSoftReview(row: CollectionsRow): boolean {
  if (
    shouldShowCustomerMayHavePaidWarning({
      viewed_at: row.viewedAt,
      balance_due: row.balanceDue,
      amount_paid_total: row.amountPaidTotal,
      status: row.status,
    })
  ) {
    return true;
  }
  return reminderSpacingNote(row.lastReminderSuccessAt) != null;
}

export function buildCollectionsCenterPayload(
  invoiceInputs: ReceivableInvoiceInput[],
  reminderByInvoiceId: Map<
    string,
    { lastSuccessAt: string | null; lastSuccessSource: "manual" | "automation" | null }
  >,
  latestPaymentMethodByInvoiceId: Map<string, string>,
  opts?: { todayYmd?: string; recentReminderWindowDays?: number }
): CollectionsCenterPayload {
  const todayYmd = opts?.todayYmd ?? getTodayYmdEastern();
  const recentWindow = opts?.recentReminderWindowDays ?? 2;

  const receivables = computeReceivablesDashboard(invoiceInputs, 0, { todayYmd });

  const normalized = invoiceInputs.map(normalizeReceivableRow);
  const rows: CollectionsRow[] = [];

  let notViewedOpenCount = 0;
  let recentlyRemindedOpenCount = 0;

  for (const base of normalized) {
    if (!invoiceCountsTowardOutstanding(base.status, base.balanceDue)) continue;

    const queueKey = classifyCollectionsQueue(base, todayYmd);
    if (!queueKey) continue;

    const rem = reminderByInvoiceId.get(base.invoiceId);
    const lastReminderSuccessAt = rem?.lastSuccessAt ?? null;
    const lastReminderSource = rem?.lastSuccessSource ?? null;
    const latestPaymentMethod = latestPaymentMethodByInvoiceId.get(base.invoiceId) ?? null;

    if (invoiceStatusesWhereCustomerViewApplies(base.status) && !base.viewedAt?.trim()) {
      notViewedOpenCount += 1;
    }
    if (isRecentReminderEastern(lastReminderSuccessAt, todayYmd, recentWindow)) {
      recentlyRemindedOpenCount += 1;
    }

    rows.push({
      ...base,
      queueKey,
      lastReminderSuccessAt,
      lastReminderSource,
      latestPaymentMethod,
    });
  }

  const summary: CollectionsSummary = {
    totalOutstanding: receivables.totalOutstanding,
    overdueAmount: receivables.overdueAmount,
    partiallyPaidAmount: receivables.partiallyPaidAmount,
    notViewedOpenCount,
    recentlyRemindedOpenCount,
  };

  return {
    summary,
    rows: sortCollectionsRowsForDisplay(rows),
    todayYmd,
  };
}

export function formatCollectionsContextLines(row: CollectionsRow): {
  dueLine: string | null;
  sentLine: string | null;
  viewedLine: string | null;
  lastPayLine: string | null;
  reminderLine: string | null;
  paymentMethodLine: string | null;
  mayHavePaid: boolean;
  spacingNote: string | null;
} {
  const dueLine =
    row.dueDate?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(row.dueDate)
      ? `Due ${formatLocalDateStringEastern(row.dueDate, { dateStyle: "medium" })}`
      : row.dueDate?.trim()
        ? `Due ${row.dueDate}`
        : null;

  const sentLine = row.sentAt?.trim()
    ? `Invoice sent ${formatDateEastern(row.sentAt, { dateStyle: "medium" })}`
    : null;

  const viewedLine = row.viewedAt?.trim()
    ? `Viewed invoice ${formatDateTimeEastern(row.viewedAt)}`
    : invoiceStatusesWhereCustomerViewApplies(row.status)
      ? "Invoice not yet viewed"
      : null;

  const lastPayLine = row.lastPaymentAt?.trim()
    ? `Last payment recorded ${formatDateEastern(row.lastPaymentAt, { dateStyle: "medium" })}`
    : null;

  const reminderLine =
    row.lastReminderSuccessAt?.trim() && row.lastReminderSource
      ? `Last reminder ${formatDateTimeEastern(row.lastReminderSuccessAt)} (${
          row.lastReminderSource === "automation" ? "automatic" : "manual"
        })`
      : row.lastReminderSuccessAt?.trim()
        ? `Last reminder ${formatDateTimeEastern(row.lastReminderSuccessAt)}`
        : null;

  const paymentMethodLine =
    row.status === "partially_paid" && row.latestPaymentMethod
      ? `Latest payment: ${formatInvoicePaymentMethod(row.latestPaymentMethod)}`
      : null;

  const mayHavePaid = shouldShowCustomerMayHavePaidWarning({
    viewed_at: row.viewedAt,
    balance_due: row.balanceDue,
    amount_paid_total: row.amountPaidTotal,
    status: row.status,
  });

  return {
    dueLine,
    sentLine,
    viewedLine,
    lastPayLine,
    reminderLine,
    paymentMethodLine,
    mayHavePaid,
    spacingNote: reminderSpacingNote(row.lastReminderSuccessAt),
  };
}
