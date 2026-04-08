/** Representative sent/paid/overdue/partially_paid row for billing summary UI (per job). */
export type SentInvoiceDisplay = {
  /** Representative row for this job’s billing summary. */
  invoice_id: string;
  status: "sent" | "paid" | "overdue" | "partially_paid";
  sent_at: string | null;
  due_date: string | null;
  /** First public invoice page open (customer), Eastern shown in UI */
  viewed_at: string | null;
  balance_due?: number | null;
  amount_paid_total?: number | null;
  paid_at?: string | null;
  last_payment_at?: string | null;
};

/** Flags from `getInvoiceDeliverySummaryForJobIds` (invoices + change orders). */
export type JobOutstandingFlags = {
  hasAnyInvoice: boolean;
  hasSentOrPaidInvoice: boolean;
  hasDraftInvoice: boolean;
  changeOrderAwaitingSignature: boolean;
  sentChangeOrderIds: string[];
  /** Set when `hasSentOrPaidInvoice`; chosen invoice for due/sent copy. */
  sentInvoiceDisplay: SentInvoiceDisplay | null;
};

export const EMPTY_JOB_OUTSTANDING: JobOutstandingFlags = {
  hasAnyInvoice: false,
  hasSentOrPaidInvoice: false,
  hasDraftInvoice: false,
  changeOrderAwaitingSignature: false,
  sentChangeOrderIds: [],
  sentInvoiceDisplay: null,
};

/** Shared styles for clickable outstanding chips (Link). */
export const outstandingIndicatorLinkClassName =
  "inline-flex max-w-full rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2";

export type JobPrimaryLifecycleStatus = {
  label: string;
  badgeClass: string;
};

/**
 * Single main lifecycle label for a job row or header.
 */
export function getJobPrimaryLifecycleStatus(job: {
  status: string;
  contract_status?: string | null;
}): JobPrimaryLifecycleStatus {
  if (job.status === "completed") {
    return {
      label: "Completed",
      badgeClass: "bg-zinc-200 text-zinc-800",
    };
  }
  if (job.status === "cancelled") {
    return {
      label: "Cancelled",
      badgeClass: "bg-red-100 text-red-800",
    };
  }
  if (job.status === "active") {
    if (job.contract_status === "signed") {
      return {
        label: "Active",
        badgeClass: "bg-green-100 text-green-800",
      };
    }
    return {
      label: "Awaiting signed contract",
      badgeClass: "bg-amber-100 text-amber-900",
    };
  }
  return {
    label: job.status,
    badgeClass: "bg-zinc-100 text-zinc-700",
  };
}

export type OutstandingIndicator = {
  id: string;
  label: string;
  badgeClass: string;
  href: string;
  ariaLabel: string;
};

function changeOrderAwaitingHref(jobId: string, sentIds: string[]): string {
  if (sentIds.length === 1) {
    return `/jobs/${jobId}/change-orders/${sentIds[0]}`;
  }
  return `/jobs/${jobId}/change-orders`;
}

function changeOrderAwaitingAriaLabel(sentIds: string[]): string {
  if (sentIds.length === 1) {
    return "Open change order awaiting signature";
  }
  return "View change orders awaiting signature";
}

/**
 * Extra badges for parallel work (contract, change orders, invoices).
 * Shown after the primary lifecycle badge. Each item includes a route for the contractor action.
 */
export function getJobOutstandingIndicators(
  jobId: string,
  job: { status: string; contract_status?: string | null },
  o: JobOutstandingFlags
): OutstandingIndicator[] {
  const out: OutstandingIndicator[] = [];
  const contract = job.contract_status ?? "none";
  const signed = contract === "signed";
  const voided = contract === "void";
  const contractPage = `/jobs/${jobId}/contract`;

  if (job.status === "active" && !voided && !signed) {
    if (contract === "pending") {
      out.push({
        id: "contract_pending",
        label: "Contract awaiting signature",
        badgeClass: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
        href: contractPage,
        ariaLabel: "Open contract — sent, awaiting customer signature",
      });
    } else if (contract === "draft" || contract === "none") {
      out.push({
        id: "contract_unsigned",
        label: "Contract unsigned",
        badgeClass: "bg-orange-50 text-orange-900 ring-1 ring-orange-200",
        href: contractPage,
        ariaLabel: "Open contract builder",
      });
    }
  }

  if (!signed || voided) {
    return out;
  }

  if (job.status === "active" || job.status === "completed") {
    if (o.changeOrderAwaitingSignature) {
      const sentIds = o.sentChangeOrderIds;
      out.push({
        id: "co_awaiting",
        label: "Change order awaiting signature",
        badgeClass: "bg-amber-50 text-amber-950 ring-1 ring-amber-300",
        href: changeOrderAwaitingHref(jobId, sentIds),
        ariaLabel: changeOrderAwaitingAriaLabel(sentIds),
      });
    }
    // Completed jobs: invoice state + CTA live in dedicated UI (dashboard + job callout).
    if (job.status === "active") {
      if (o.hasDraftInvoice) {
        out.push({
          id: "invoice_draft",
          label: "Draft invoice",
          badgeClass: "bg-violet-50 text-violet-900 ring-1 ring-violet-200",
          href: `/jobs/${jobId}/invoices`,
          ariaLabel: "Open invoices — finish or send draft",
        });
      }
      if (!o.hasSentOrPaidInvoice && !o.hasDraftInvoice) {
        out.push({
          id: "invoice_unsent",
          label: "Invoice not sent",
          badgeClass: "bg-sky-50 text-sky-900 ring-1 ring-sky-200",
          href: `/jobs/${jobId}/invoices`,
          ariaLabel: "Open invoices to create or send invoice",
        });
      }
    }
  }

  return out;
}

/** @deprecated Use getJobPrimaryLifecycleStatus — kept for any legacy imports. */
export function getJobListStatusDisplay(job: {
  status: string;
  contract_status?: string | null;
}): JobPrimaryLifecycleStatus {
  return getJobPrimaryLifecycleStatus(job);
}
