import type { PartnerApplyFlow } from "@/lib/partners/submit-application";

export const PARTNER_APPLY_PAGE_TITLE = "Apply to become a partner";

export const PARTNER_APPLY_PAGE_INTRO =
  "Tell us about your organization and create your JobProof account. You can use it to check your application status, and Partner Portal access will open after approval.";

export const PARTNER_APPLY_SUCCESS_HEADING = "Application submitted";

export const PARTNER_APPLY_SUCCESS_CTA_STATUS = "Check application status";
export const PARTNER_APPLY_SUCCESS_CTA_RETURN = "Return to Partner Program";

export const PARTNER_APPLY_STATUS_PATH = "/partner/status";
export const PARTNER_APPLY_LOGIN_STATUS_HREF = `/login?next=${encodeURIComponent(PARTNER_APPLY_STATUS_PATH)}`;

const SHARED_PORTAL_LOCK =
  "Your Partner Portal will automatically become available once your application has been approved.";

export type PartnerApplySuccessCopy = {
  heading: string;
  paragraphs: string[];
};

/** Success-panel copy for new vs existing JobProof account apply flows. */
export function getPartnerApplySuccessCopy(
  flow: PartnerApplyFlow
): PartnerApplySuccessCopy {
  if (flow === "existing_account") {
    return {
      heading: PARTNER_APPLY_SUCCESS_HEADING,
      paragraphs: [
        "Thanks! Your partner application has been received.",
        "We’ve sent a confirmation email. If prompted, please verify your email address.",
        "Your existing JobProof account is linked to this application. You can use it to check your application status.",
        SHARED_PORTAL_LOCK,
      ],
    };
  }

  return {
    heading: PARTNER_APPLY_SUCCESS_HEADING,
    paragraphs: [
      "Thanks! Your partner application has been received.",
      "We’ve sent a confirmation email. If prompted, please verify your email address.",
      "Your JobProof account is ready. You can now sign in with the username or email and password you chose during the application to check your application status.",
      SHARED_PORTAL_LOCK,
    ],
  };
}

/**
 * Status CTA: authenticated applicants go to /partner/status;
 * signed-out users go through login with next preserved.
 * Never routes to the active Partner Portal dashboard.
 */
export function getPartnerApplyStatusCheckHref(signedIn: boolean): string {
  return signedIn
    ? PARTNER_APPLY_STATUS_PATH
    : PARTNER_APPLY_LOGIN_STATUS_HREF;
}
