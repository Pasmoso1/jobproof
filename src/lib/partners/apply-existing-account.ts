/**
 * Signed-out Partner apply: existing JobProof Auth / application continue UX.
 * Detection stays inside the apply server action — no public email-enumeration API.
 */

import { PARTNER_PROGRAM_LOGIN_NEXT } from "@/lib/partners/login-href";
import {
  ORGANIZATION_APPLY_LOGIN_NEXT,
  PARTNER_APPLY_LOGIN_NEXT,
  partnerApplyLoginHref,
} from "@/lib/partners/application-draft";

export const PARTNER_EXISTING_ACCOUNT_TITLE = "Sign in to continue";

export const PARTNER_EXISTING_ACCOUNT_BODY =
  "This email is already associated with a JobProof account. Sign in with that account to continue your Partner application.";

export const PARTNER_EXISTING_APPLICATION_BODY =
  "An application with this email is already on file. Sign in to check your Partner application status.";

export const PARTNER_EXISTING_PARTNER_BODY =
  "This email is already linked to a JobProof Partner account. Sign in to open the Partner Portal.";

export const PARTNER_EXISTING_ACCOUNT_PRIMARY_CTA = "Sign in to continue";

export const PARTNER_EXISTING_ACCOUNT_SECONDARY_CTA = "Use a different email";

export const PARTNER_EXISTING_ACCOUNT_FORGOT_PASSWORD_LABEL =
  "Forgot your password?";

export const PARTNER_EXISTING_ACCOUNT_FORGOT_PASSWORD_HREF = "/forgot-password";

export type PartnerExistingAccountContinueKind =
  | "existing_account"
  | "existing_application"
  | "existing_partner";

export function partnerExistingAccountBody(
  kind: PartnerExistingAccountContinueKind
): string {
  if (kind === "existing_application") return PARTNER_EXISTING_APPLICATION_BODY;
  if (kind === "existing_partner") return PARTNER_EXISTING_PARTNER_BODY;
  return PARTNER_EXISTING_ACCOUNT_BODY;
}

/**
 * Where to send the applicant after they authenticate from the continue panel.
 * Existing Auth-only → back to the apply form (draft restored).
 * Existing application/partner → Partner entry resolver (/partner).
 */
export function partnerExistingAccountLoginNext(
  kind: PartnerExistingAccountContinueKind,
  applyPath:
    | typeof PARTNER_APPLY_LOGIN_NEXT
    | typeof ORGANIZATION_APPLY_LOGIN_NEXT
): string {
  if (kind === "existing_account") return applyPath;
  return PARTNER_PROGRAM_LOGIN_NEXT;
}

export function partnerExistingAccountLoginHref(
  kind: PartnerExistingAccountContinueKind,
  applyPath:
    | typeof PARTNER_APPLY_LOGIN_NEXT
    | typeof ORGANIZATION_APPLY_LOGIN_NEXT
): string {
  return partnerApplyLoginHref(partnerExistingAccountLoginNext(kind, applyPath));
}

export type EmailApplyBlocker =
  | { kind: "open_application" }
  | { kind: "active_partner" };

export function emailApplyBlockerToContinueKind(
  blocker: EmailApplyBlocker
): Exclude<PartnerExistingAccountContinueKind, "existing_account"> {
  return blocker.kind === "active_partner"
    ? "existing_partner"
    : "existing_application";
}
