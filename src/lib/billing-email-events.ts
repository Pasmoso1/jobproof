/**
 * Placeholders for future transactional billing email delivery.
 * Do not send email from here yet — keeps call sites ready for integration.
 */

export type BillingEmailProfileRef = {
  profileId: string;
  userEmail?: string | null;
};

export async function sendUpgradeConfirmationEmail(_ref: BillingEmailProfileRef): Promise<void> {
  /* Stub — wire to email provider when ready */
}

export async function sendCancellationScheduledEmail(_ref: BillingEmailProfileRef): Promise<void> {
  /* Stub */
}

export async function sendCancellationResumedEmail(_ref: BillingEmailProfileRef): Promise<void> {
  /* Stub */
}

export async function sendPaymentFailedEmail(_ref: BillingEmailProfileRef): Promise<void> {
  /* Stub */
}

export async function sendTrialEndingSoonEmail(_ref: BillingEmailProfileRef): Promise<void> {
  /* Stub */
}
