/** Matches `invoice_payments.payment_method` CHECK constraint. */
export type InvoicePaymentMethod = "e_transfer" | "cash" | "cheque" | "card" | "other";

export const INVOICE_PAYMENT_METHOD_OPTIONS: { value: InvoicePaymentMethod; label: string }[] = [
  { value: "e_transfer", label: "E-transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

export function isInvoicePaymentMethod(s: string): s is InvoicePaymentMethod {
  return (
    s === "e_transfer" ||
    s === "cash" ||
    s === "cheque" ||
    s === "card" ||
    s === "other"
  );
}

export function formatInvoicePaymentMethod(method: string): string {
  const row = INVOICE_PAYMENT_METHOD_OPTIONS.find((o) => o.value === method);
  return row?.label ?? method;
}
