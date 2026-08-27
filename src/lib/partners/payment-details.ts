/** Partner payout presentation helpers (Interac e-Transfer). */

export const PARTNER_PAYMENT_METHOD_LABEL = "Interac e-Transfer";

export const PARTNER_PAYMENT_EMAIL_HELPER =
  "The email address where you would like to receive Interac e-Transfer payments.";

export const PARTNER_MISSING_PAYMENT_EMAIL_PROMPT =
  "Add your payment email to receive referral rewards.";

/** True when the partner has a non-empty payout email on file. */
export function hasPartnerPaymentEmail(
  paymentEmail: string | null | undefined
): boolean {
  return Boolean(String(paymentEmail ?? "").trim());
}
