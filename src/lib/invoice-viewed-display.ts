import { formatDateTimeEastern } from "@/lib/datetime-eastern";

/**
 * Secondary copy for contractor UIs: invoice viewed on the public page or not yet.
 * Timestamps use America/Toronto via formatDateTimeEastern.
 */
export function invoiceCustomerViewSecondaryLine(opts: {
  viewedAt: string | null | undefined;
  /** When the invoice is out for payment (sent / paid / overdue) but not yet viewed */
  showNotYetViewed: boolean;
  /** DB invoice status; when `overdue` and viewed, appends payment note after the viewed time */
  invoiceStatus?: string | null;
}): string | null {
  const v = opts.viewedAt?.trim();
  if (v) {
    const viewedPart = `Viewed invoice ${formatDateTimeEastern(v)}`;
    if (opts.invoiceStatus === "overdue") {
      return `${viewedPart} · Payment overdue`;
    }
    return viewedPart;
  }
  if (opts.showNotYetViewed) return "Invoice not yet viewed";
  return null;
}

export function invoiceStatusesWhereCustomerViewApplies(status: string): boolean {
  return (
    status === "sent" ||
    status === "paid" ||
    status === "overdue" ||
    status === "partially_paid"
  );
}
