/**
 * Payment / contact copy for invoices (email + public invoice page).
 */
export function buildInvoicePaymentBlocks(
  profile: {
    contractor_name?: string | null;
    phone?: string | null;
    default_contract_payment_terms?: string | null;
    e_transfer_email?: string | null;
  },
  bizName: string,
  userEmail: string | null | undefined
): { paymentInstructions: string; paymentContactLines: string[] } {
  const et = profile.e_transfer_email?.trim() || null;
  const paymentContactLines = [
    profile.contractor_name?.trim()
      ? `Contact: ${profile.contractor_name.trim()}`
      : null,
    profile.phone?.trim() ? `Phone: ${profile.phone.trim()}` : null,
    userEmail?.trim() ? `Email: ${userEmail.trim()}` : null,
    et ? `E-transfer: ${et}` : null,
  ].filter(Boolean) as string[];

  const etSentence = et
    ? ` For Interac e-Transfer, send payment to ${et}.`
    : "";

  const defaultPaymentCopy = `Please pay the balance due using the method you agreed with ${bizName}.${etSentence} If you have not arranged payment yet, use the payment contact information below.`;

  const paymentInstructions = profile.default_contract_payment_terms?.trim()
    ? `${profile.default_contract_payment_terms.trim()}\n\n${defaultPaymentCopy}`
    : defaultPaymentCopy;

  return { paymentInstructions, paymentContactLines };
}
