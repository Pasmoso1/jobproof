/** Feedback mailto for in-app “Send feedback” links. */
export const JOBPROOF_FEEDBACK_EMAIL = "support@jobproof.ca";

export function getFeedbackMailtoHref(subject = "JobProof feedback"): string {
  const q = encodeURIComponent(subject);
  return `mailto:${JOBPROOF_FEEDBACK_EMAIL}?subject=${q}`;
}
