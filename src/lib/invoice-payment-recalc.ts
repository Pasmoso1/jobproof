import { getTodayYmdEastern } from "@/lib/datetime-eastern";

export const INVOICE_PAYMENT_EPS = 0.01;

export function roundInvoiceMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type InvoicePaymentDerivedStatus = "sent" | "overdue" | "partially_paid" | "paid";

/**
 * Amount owed after deposit, before payment rows (same basis as `balance_due` at issue).
 */
export function grossBalanceAfterDeposit(total: number, depositCredited: number): number {
  const t = Number(total);
  const d = Number(depositCredited ?? 0);
  return roundInvoiceMoney(Math.max(0, t - d));
}

export function computePaymentDerivedState(input: {
  total: number;
  depositCredited: number;
  paymentSum: number;
  dueDateYmd: string | null | undefined;
  sentAt: string | null | undefined;
  todayYmd?: string;
}): {
  amount_paid_total: number;
  balance_due: number;
  status: InvoicePaymentDerivedStatus;
} {
  const todayYmd = input.todayYmd ?? getTodayYmdEastern();
  const gross = grossBalanceAfterDeposit(input.total, input.depositCredited);
  const paidSum = roundInvoiceMoney(Math.max(0, Number(input.paymentSum)));
  let balance = roundInvoiceMoney(gross - paidSum);
  if (balance < 0) balance = 0;

  const sent = Boolean(input.sentAt?.trim());

  if (paidSum < INVOICE_PAYMENT_EPS) {
    const due = input.dueDateYmd?.trim();
    const overdue =
      Boolean(due && /^\d{4}-\d{2}-\d{2}$/.test(due) && due < todayYmd);
    return {
      amount_paid_total: 0,
      balance_due: gross,
      status: sent && overdue ? "overdue" : sent ? "sent" : "sent",
    };
  }

  if (balance > INVOICE_PAYMENT_EPS) {
    return {
      amount_paid_total: paidSum,
      balance_due: balance,
      status: "partially_paid",
    };
  }

  return {
    amount_paid_total: paidSum,
    balance_due: 0,
    status: "paid",
  };
}

/** Keep paid_at when still paid; set now when newly paid; clear when not paid. */
export function resolvePaidAtAfterRecalc(opts: {
  previousStatus: string;
  newStatus: string;
  previousPaidAt: string | null | undefined;
}): string | null {
  if (opts.newStatus !== "paid") return null;
  if (opts.previousStatus === "paid" && opts.previousPaidAt?.trim()) {
    return opts.previousPaidAt.trim();
  }
  return new Date().toISOString();
}
