/** Flags from `getInvoiceDeliverySummaryForJobIds` (invoices + change orders). */
export type JobOutstandingFlags = {
  hasAnyInvoice: boolean;
  hasSentOrPaidInvoice: boolean;
  hasDraftInvoice: boolean;
  changeOrderAwaitingSignature: boolean;
};

export const EMPTY_JOB_OUTSTANDING: JobOutstandingFlags = {
  hasAnyInvoice: false,
  hasSentOrPaidInvoice: false,
  hasDraftInvoice: false,
  changeOrderAwaitingSignature: false,
};

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
};

/**
 * Extra badges for parallel work (contract, change orders, invoices).
 * Shown after the primary lifecycle badge.
 */
export function getJobOutstandingIndicators(
  job: { status: string; contract_status?: string | null },
  o: JobOutstandingFlags
): OutstandingIndicator[] {
  const out: OutstandingIndicator[] = [];
  const contract = job.contract_status ?? "none";
  const signed = contract === "signed";
  const voided = contract === "void";

  if (job.status === "active" && !voided && !signed) {
    if (contract === "pending") {
      out.push({
        id: "contract_pending",
        label: "Contract awaiting signature",
        badgeClass: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
      });
    } else if (contract === "draft" || contract === "none") {
      out.push({
        id: "contract_unsigned",
        label: "Contract unsigned",
        badgeClass: "bg-orange-50 text-orange-900 ring-1 ring-orange-200",
      });
    }
  }

  if (!signed || voided) {
    return out;
  }

  if (job.status === "active" || job.status === "completed") {
    if (o.changeOrderAwaitingSignature) {
      out.push({
        id: "co_awaiting",
        label: "Change order awaiting signature",
        badgeClass: "bg-amber-50 text-amber-950 ring-1 ring-amber-300",
      });
    }
    if (o.hasDraftInvoice) {
      out.push({
        id: "invoice_draft",
        label: "Draft invoice",
        badgeClass: "bg-violet-50 text-violet-900 ring-1 ring-violet-200",
      });
    }
    if (!o.hasSentOrPaidInvoice && !o.hasDraftInvoice) {
      out.push({
        id: "invoice_unsent",
        label: "Invoice not sent",
        badgeClass: "bg-sky-50 text-sky-900 ring-1 ring-sky-200",
      });
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
