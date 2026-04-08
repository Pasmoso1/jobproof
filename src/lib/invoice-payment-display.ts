import {
  formatDateEastern,
  formatLocalDateStringEastern,
} from "@/lib/datetime-eastern";
import { formatInvoicePaymentMethod } from "@/lib/invoice-payment-method";

export function contractorInvoicePaymentStatusLabel(
  status: string
): string {
  switch (status) {
    case "partially_paid":
      return "Partially paid";
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    case "sent":
      return "Sent";
    case "draft":
      return "Draft";
    default:
      return status.replace(/_/g, " ");
  }
}

export type PaymentTimelineLine = {
  key: string;
  title: string;
  detail?: string;
};

export function buildInvoicePaymentTimelineLines(input: {
  sentAt: string | null | undefined;
  payments: {
    id: string;
    amount: number;
    paid_on: string;
    payment_method: string;
    note: string | null;
  }[];
  balanceDue: number;
  invoiceStatus: string;
  paidAt: string | null | undefined;
}): PaymentTimelineLine[] {
  const lines: PaymentTimelineLine[] = [];

  if (input.sentAt?.trim()) {
    lines.push({
      key: "sent",
      title: `Invoice sent ${formatDateEastern(input.sentAt, { dateStyle: "medium" })}`,
    });
  }

  for (const p of input.payments) {
    const amt = Number(p.amount);
    const method = formatInvoicePaymentMethod(p.payment_method);
    const note = p.note?.trim();
    lines.push({
      key: `pay-${p.id}`,
      title: `Payment received ${formatLocalDateStringEastern(p.paid_on, { dateStyle: "medium" })}`,
      detail: `$${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${method}${note ? ` · ${note}` : ""}`,
    });
  }

  const bal = Number(input.balanceDue);
  const st = input.invoiceStatus;

  if (st === "paid" && input.paidAt?.trim()) {
    lines.push({
      key: "paid-full",
      title: `Paid in full ${formatDateEastern(input.paidAt, { dateStyle: "medium" })}`,
    });
  } else if (bal > 0.0001 && (st === "partially_paid" || st === "sent" || st === "overdue")) {
    lines.push({
      key: "remaining",
      title: `Remaining balance $${bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    });
  }

  return lines;
}
