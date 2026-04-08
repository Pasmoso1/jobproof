import { formatDateTimeEastern } from "@/lib/datetime-eastern";

/**
 * Secondary copy for contractor UIs: customer opened the public invoice link or not yet.
 * Timestamps use America/Toronto via formatDateTimeEastern.
 */
export function invoiceCustomerViewSecondaryLine(opts: {
  viewedAt: string | null | undefined;
  /** When the invoice is out for payment (sent / paid / overdue) but not opened yet */
  showNotYetViewed: boolean;
  /** DB invoice status; when `overdue` and viewed, appends payment note after the viewed time */
  invoiceStatus?: string | null;
}): string | null {
  const v = opts.viewedAt?.trim();
  if (v) {
    const viewedPart = `Viewed ${formatDateTimeEastern(v)}`;
    if (opts.invoiceStatus === "overdue") {
      return `${viewedPart} · Payment overdue`;
    }
    return viewedPart;
  }
  if (opts.showNotYetViewed) return "Not yet viewed by customer";
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
