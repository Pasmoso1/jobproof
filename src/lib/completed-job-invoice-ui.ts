import {
  formatDateTimeEastern,
  formatLocalDateStringEastern,
} from "@/lib/datetime-eastern";
import type { JobOutstandingFlags, SentInvoiceDisplay } from "@/lib/job-dashboard-status";

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
  actionLabel: string;
  invoicesHref: string;
};

type InvoiceRow = {
  status: string;
  sent_at: string | null;
  due_date: string | null;
  paid_at: string | null;
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
      status: "overdue",
      sent_at: pick.sent_at,
      due_date: pick.due_date,
    };
  }

  const sentOnly = post.filter((r) => r.status === "sent");
  if (sentOnly.length > 0) {
    const pick = [...sentOnly].sort(
      (a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? "")
    )[0];
    return {
      status: "sent",
      sent_at: pick.sent_at,
      due_date: pick.due_date,
    };
  }

  const paidOnly = post.filter((r) => r.status === "paid");
  const pick = [...paidOnly].sort((a, b) =>
    (b.paid_at ?? b.sent_at ?? "").localeCompare(a.paid_at ?? a.sent_at ?? "")
  )[0];
  return {
    status: "paid",
    sent_at: pick.sent_at,
    due_date: pick.due_date,
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

    if (display?.status === "overdue") {
      return {
        statusKind: "overdue",
        statusLabel: "Invoice overdue",
        statusBadgeClass: "bg-red-100 text-red-900 ring-1 ring-red-300",
        billingDetailLine,
        actionLabel: "Resend invoice",
        invoicesHref,
      };
    }

    if (display?.status === "paid") {
      return {
        statusKind: "paid",
        statusLabel: "Invoice paid",
        statusBadgeClass: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
        billingDetailLine,
        actionLabel: "Resend invoice",
        invoicesHref,
      };
    }

    return {
      statusKind: "sent",
      statusLabel: "Invoice sent",
      statusBadgeClass: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
      billingDetailLine,
      actionLabel: "Resend invoice",
      invoicesHref,
    };
  }
  if (o.hasDraftInvoice) {
    return {
      statusKind: "draft",
      statusLabel: "Draft invoice",
      statusBadgeClass: "bg-violet-50 text-violet-900 ring-1 ring-violet-200",
      billingDetailLine: null,
      actionLabel: "Send invoice",
      invoicesHref,
    };
  }
  return {
    statusKind: "not_sent",
    statusLabel: "Invoice not sent",
    statusBadgeClass: "bg-sky-50 text-sky-900 ring-1 ring-sky-200",
    billingDetailLine: null,
    actionLabel: "Create invoice",
    invoicesHref,
  };
}
