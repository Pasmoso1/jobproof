import {
  formatDateTimeEastern,
  formatLocalDateStringEastern,
} from "@/lib/datetime-eastern";
import type { JobOutstandingFlags, SentInvoiceDisplay } from "@/lib/job-dashboard-status";
import { invoiceCustomerViewSecondaryLine } from "@/lib/invoice-viewed-display";

export type CompletedJobInvoiceStatusKind =
  | "sent"
  | "paid"
  | "overdue"
  | "draft"
  | "not_sent";

export type CompletedJobInvoiceUi = {
  statusKind: CompletedJobInvoiceStatusKind;
  /** Short label for pills / callouts */
  statusLabel: string;
  statusBadgeClass: string;
  /** One short line: due date, sent date, or paid + sent (Eastern). */
  billingDetailLine: string | null;
  /** Customer public-page view (sent / paid / overdue only). */
  viewedDetailLine: string | null;
  actionLabel: string;
  invoicesHref: string;
  /** Latest representative invoice for reminders (sent / overdue only). */
  reminderInvoiceId: string | null;
};

type InvoiceRow = {
  id: string;
  status: string;
  sent_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  viewed_at: string | null;
};

/**
 * Picks one invoice to summarize for UI: overdue first (earliest due), else latest sent, else latest paid.
 */
export function pickSentInvoiceDisplay(rows: InvoiceRow[]): SentInvoiceDisplay | null {
  const post = rows.filter(
    (r) =>
      r.status === "sent" || r.status === "paid" || r.status === "overdue"
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
  };
}

function buildBillingDetailLine(display: SentInvoiceDisplay | null): string | null {
  if (!display) return null;
  const dueStr = display.due_date
    ? formatLocalDateStringEastern(display.due_date, { dateStyle: "medium" })
    : "";
  const sentStr = display.sent_at ? formatDateTimeEastern(display.sent_at) : "";

  if (display.status === "overdue") {
    if (dueStr) return `Due ${dueStr}`;
    if (sentStr) return `Sent ${sentStr}`;
    return null;
  }
  if (display.status === "paid") {
    if (sentStr) return `Paid · Sent ${sentStr}`;
    return "Paid";
  }
  if (dueStr) return `Due ${dueStr}`;
  if (sentStr) return `Sent ${sentStr}`;
  return null;
}

/**
 * Maps invoice flags to a visible status and primary CTA for completed, signed jobs.
 * Priority: sent/paid/overdue → draft → not sent.
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
  };
}
