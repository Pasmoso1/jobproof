/**
 * Placeholders for future transactional billing email delivery.
 * Do not send email from here yet — keeps call sites ready for integration.
 */

export type BillingEmailProfileRef = {
  profileId: string;
  userEmail?: string | null;
};

export async function sendUpgradeConfirmationEmail(ref: BillingEmailProfileRef): Promise<void> {
  void ref;
}

export async function sendCancellationScheduledEmail(ref: BillingEmailProfileRef): Promise<void> {
  void ref;
}

export async function sendCancellationResumedEmail(ref: BillingEmailProfileRef): Promise<void> {
  void ref;
}

export async function sendPaymentFailedEmail(ref: BillingEmailProfileRef): Promise<void> {
  void ref;
}

export async function sendTrialEndingSoonEmail(ref: BillingEmailProfileRef): Promise<void> {
  void ref;
}
