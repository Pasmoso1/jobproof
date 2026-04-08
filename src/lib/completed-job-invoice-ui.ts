import {
  formatDateTimeEastern,
  formatLocalDateStringEastern,
} from "@/lib/datetime-eastern";
import type { JobOutstandingFlags, SentInvoiceDisplay } from "@/lib/job-dashboard-status";
import { invoiceCustomerViewSecondaryLine } from "@/lib/invoice-viewed-display";
import { shouldShowCustomerMayHavePaidWarning } from "@/lib/invoice-reminder-automation";

export type CompletedJobInvoiceStatusKind =
  | "sent"
  | "paid"
  | "overdue"
  | "partially_paid"
  | "draft"
  | "not_sent";

export type CompletedJobInvoiceUi = {
  statusKind: CompletedJobInvoiceStatusKind;
  /** Short label for pills / callouts */
  statusLabel: string;
  statusBadgeClass: string;
  /** One short line: due date, sent date, or paid + sent (Eastern). */
  billingDetailLine: string | null;
  /** Customer public-page view (sent / paid / overdue / partially_paid only). */
  viewedDetailLine: string | null;
  actionLabel: string;
  invoicesHref: string;
  /** Latest representative invoice for reminders (balance outstanding). */
  reminderInvoiceId: string | null;
  /** Subtle nudge when customer opened the invoice recently but no payment recorded. */
  customerMayHavePaidReminderWarning: boolean;
};

type InvoiceRow = {
  id: string;
  status: string;
  sent_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  viewed_at: string | null;
  balance_due?: number | null;
  amount_paid_total?: number | null;
  last_payment_at?: string | null;
};

function moneyShort(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Picks one invoice to summarize for UI: overdue first (earliest due), else latest partially paid,
 * else latest sent, else latest paid.
 */
export function pickSentInvoiceDisplay(rows: InvoiceRow[]): SentInvoiceDisplay | null {
  const post = rows.filter(
    (r) =>
      r.status === "sent" ||
      r.status === "paid" ||
      r.status === "overdue" ||
      r.status === "partially_paid"
  );
  if (post.length === 0) return null;

  const overdue = post.filter((r) => r.status === "overdue");
  if (overdue.length > 0) {
    const pick = [...overdue].sort((a, b) => {
      const da = a.due_date ?? "\xff";
      const db = b.due_date ?? "\xff";
      if (da !== db) return da.localeCompare(db);
      return (b.sent_at ?? "").localeCompare(a.sent_at ?? "");
    })[0];
    return {
      invoice_id: pick.id,
      status: "overdue",
      sent_at: pick.sent_at,
      due_date: pick.due_date,
      viewed_at: pick.viewed_at ?? null,
      balance_due: pick.balance_due ?? null,
      amount_paid_total: pick.amount_paid_total ?? null,
      paid_at: pick.paid_at ?? null,
      last_payment_at: pick.last_payment_at ?? null,
    };
  }

  const partial = post.filter((r) => r.status === "partially_paid");
  if (partial.length > 0) {
    const pick = [...partial].sort(
      (a, b) => (b.last_payment_at ?? b.sent_at ?? "").localeCompare(a.last_payment_at ?? a.sent_at ?? "")
    )[0];
    return {
      invoice_id: pick.id,
      status: "partially_paid",
      sent_at: pick.sent_at,
      due_date: pick.due_date,
      viewed_at: pick.viewed_at ?? null,
      balance_due: pick.balance_due ?? null,
      amount_paid_total: pick.amount_paid_total ?? null,
      paid_at: pick.paid_at ?? null,
      last_payment_at: pick.last_payment_at ?? null,
    };
  }

  const sentOnly = post.filter((r) => r.status === "sent");
  if (sentOnly.length > 0) {
    const pick = [...sentOnly].sort(
      (a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? "")
    )[0];
    return {
      invoice_id: pick.id,
      status: "sent",
      sent_at: pick.sent_at,
      due_date: pick.due_date,
      viewed_at: pick.viewed_at ?? null,
      balance_due: pick.balance_due ?? null,
      amount_paid_total: pick.amount_paid_total ?? null,
      paid_at: pick.paid_at ?? null,
      last_payment_at: pick.last_payment_at ?? null,
    };
  }

  const paidOnly = post.filter((r) => r.status === "paid");
  const pick = [...paidOnly].sort((a, b) =>
    (b.paid_at ?? b.sent_at ?? "").localeCompare(a.paid_at ?? a.sent_at ?? "")
  )[0];
  return {
    invoice_id: pick.id,
    status: "paid",
    sent_at: pick.sent_at,
    due_date: pick.due_date,
    viewed_at: pick.viewed_at ?? null,
    balance_due: pick.balance_due ?? null,
    amount_paid_total: pick.amount_paid_total ?? null,
    paid_at: pick.paid_at ?? null,
    last_payment_at: pick.last_payment_at ?? null,
  };
}

function buildBillingDetailLine(display: SentInvoiceDisplay | null): string | null {
  if (!display) return null;
  const dueStr = display.due_date
    ? formatLocalDateStringEastern(display.due_date, { dateStyle: "medium" })
    : "";
  const sentStr = display.sent_at ? formatDateTimeEastern(display.sent_at) : "";
  const paidTotal = display.amount_paid_total != null ? Number(display.amount_paid_total) : 0;
  const bal =
    display.balance_due != null && Number.isFinite(Number(display.balance_due))
      ? Number(display.balance_due)
      : null;

  if (display.status === "overdue") {
    if (dueStr) return `Due ${dueStr}`;
    if (sentStr) return `Sent ${sentStr}`;
    return null;
  }

  if (display.status === "partially_paid") {
    const parts: string[] = [];
    if (paidTotal > 0) parts.push(`Paid to date $${moneyShort(paidTotal)}`);
    if (bal != null && bal > 0.0001) parts.push(`Balance $${moneyShort(bal)}`);
    const lp = display.last_payment_at?.trim();
    if (lp) {
      const ymd = lp.includes("T") ? lp.split("T")[0]! : lp.slice(0, 10);
      if (ymd) {
        parts.push(
          `Last payment ${formatLocalDateStringEastern(ymd, { dateStyle: "medium" })}`
        );
      }
    } else if (dueStr) {
      parts.push(`Due ${dueStr}`);
    }
    return parts.length > 0 ? parts.join(" · ") : dueStr ? `Due ${dueStr}` : null;
  }

  if (display.status === "paid") {
    const paidAt = display.paid_at?.trim();
    if (paidAt) {
      return `Paid in full · ${formatDateTimeEastern(paidAt)}`;
    }
    if (sentStr) return `Paid · Sent ${sentStr}`;
    return "Paid in full";
  }
  if (dueStr) return `Due ${dueStr}`;
  if (sentStr) return `Sent ${sentStr}`;
  return null;
}

function remainingBalanceForReminders(display: SentInvoiceDisplay | null): number {
  if (!display) return 0;
  const b = display.balance_due;
  if (b == null || !Number.isFinite(Number(b))) return 0;
  return Math.max(0, Number(b));
}

function customerMayHavePaidWarn(display: SentInvoiceDisplay | null): boolean {
  if (!display) return false;
  return shouldShowCustomerMayHavePaidWarning({
    viewed_at: display.viewed_at,
    balance_due: display.balance_due ?? null,
    amount_paid_total: display.amount_paid_total ?? null,
    status: display.status,
  });
}

/**
 * Maps invoice flags to a visible status and primary CTA for completed, signed jobs.
 * Priority: sent/paid/overdue/partially_paid → draft → not sent.
 */
export function getCompletedJobInvoiceUi(
  jobId: string,
  o: JobOutstandingFlags
): CompletedJobInvoiceUi {
  const invoicesHref = `/jobs/${jobId}/invoices`;
  if (o.hasSentOrPaidInvoice) {
    const display = o.sentInvoiceDisplay;
    const billingDetailLine = buildBillingDetailLine(display);
    const viewedDetailLine = invoiceCustomerViewSecondaryLine({
      viewedAt: display?.viewed_at,
      showNotYetViewed: true,
      invoiceStatus: display?.status,
    });
    const remindBalance = remainingBalanceForReminders(display);

    if (display?.status === "overdue") {
      return {
        statusKind: "overdue",
        statusLabel: "Invoice overdue",
        statusBadgeClass: "bg-red-100 text-red-900 ring-1 ring-red-300",
        billingDetailLine,
        viewedDetailLine,
        actionLabel: "Resend invoice",
        invoicesHref,
        reminderInvoiceId: display.invoice_id,
        customerMayHavePaidReminderWarning: customerMayHavePaidWarn(display),
      };
    }

    if (display?.status === "partially_paid") {
      return {
        statusKind: "partially_paid",
        statusLabel: "Partially paid",
        statusBadgeClass: "bg-amber-50 text-amber-950 ring-1 ring-amber-200",
        billingDetailLine,
        viewedDetailLine,
        actionLabel: "Resend invoice",
        invoicesHref,
        reminderInvoiceId: remindBalance > 0.0001 ? display.invoice_id : null,
        customerMayHavePaidReminderWarning: customerMayHavePaidWarn(display),
      };
    }

    if (display?.status === "paid") {
      return {
        statusKind: "paid",
        statusLabel: "Invoice paid",
        statusBadgeClass: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
        billingDetailLine,
        viewedDetailLine,
        actionLabel: "Resend invoice",
        invoicesHref,
        reminderInvoiceId: null,
        customerMayHavePaidReminderWarning: false,
      };
    }

    return {
      statusKind: "sent",
      statusLabel: "Invoice sent",
      statusBadgeClass: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
      billingDetailLine,
      viewedDetailLine,
      actionLabel: "Resend invoice",
      invoicesHref,
      reminderInvoiceId: display?.invoice_id ?? null,
      customerMayHavePaidReminderWarning: customerMayHavePaidWarn(display),
    };
  }
  if (o.hasDraftInvoice) {
    return {
      statusKind: "draft",
      statusLabel: "Draft invoice",
      statusBadgeClass: "bg-violet-50 text-violet-900 ring-1 ring-violet-200",
      billingDetailLine: null,
      viewedDetailLine: null,
      actionLabel: "Send invoice",
      invoicesHref,
      reminderInvoiceId: null,
      customerMayHavePaidReminderWarning: false,
    };
  }
  return {
    statusKind: "not_sent",
    statusLabel: "Invoice not sent",
    statusBadgeClass: "bg-sky-50 text-sky-900 ring-1 ring-sky-200",
    billingDetailLine: null,
    viewedDetailLine: null,
    actionLabel: "Create invoice",
    invoicesHref,
    reminderInvoiceId: null,
    customerMayHavePaidReminderWarning: false,
  };
}
