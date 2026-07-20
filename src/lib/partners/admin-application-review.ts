import type { PartnerApplicationStatus } from "@/lib/partners/constants";

export type AdminApplicationDetail = {
  id: string;
  organization_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  partner_type: string;
  estimated_audience: string | null;
  promotion_plan: string;
  reason: string;
  status: PartnerApplicationStatus | string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  decline_reason: string | null;
  agreement_version: string | null;
  agreement_accepted_at: string | null;
  created_partner_id: string | null;
};

export type ApplicationReviewActions = {
  canMarkUnderReview: boolean;
  showUnderReviewBadge: boolean;
  canApprove: boolean;
  canDecline: boolean;
  showApprovedState: boolean;
  showDeclinedState: boolean;
};

export function displayOptionalAdminValue(
  value: string | null | undefined
): string {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : "Not provided.";
}

export function websiteHref(website: string | null | undefined): string | null {
  const trimmed = String(website ?? "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function hasValidAgreementAcceptance(app: {
  agreement_version: string | null;
  agreement_accepted_at: string | null;
}): boolean {
  return Boolean(
    app.agreement_version?.trim() && app.agreement_accepted_at?.trim()
  );
}

export function getApplicationReviewActions(
  status: string
): ApplicationReviewActions {
  switch (status) {
    case "submitted":
      return {
        canMarkUnderReview: true,
        showUnderReviewBadge: false,
        canApprove: true,
        canDecline: true,
        showApprovedState: false,
        showDeclinedState: false,
      };
    case "under_review":
      return {
        canMarkUnderReview: false,
        showUnderReviewBadge: true,
        canApprove: true,
        canDecline: true,
        showApprovedState: false,
        showDeclinedState: false,
      };
    case "approved":
      return {
        canMarkUnderReview: false,
        showUnderReviewBadge: false,
        canApprove: false,
        canDecline: false,
        showApprovedState: true,
        showDeclinedState: false,
      };
    case "declined":
      return {
        canMarkUnderReview: false,
        showUnderReviewBadge: false,
        canApprove: false,
        canDecline: false,
        showApprovedState: false,
        showDeclinedState: true,
      };
    default:
      return {
        canMarkUnderReview: false,
        showUnderReviewBadge: false,
        canApprove: false,
        canDecline: false,
        showApprovedState: false,
        showDeclinedState: false,
      };
  }
}

export function applicationStatusLabel(status: string): string {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "under_review":
      return "Under review";
    case "approved":
      return "Approved";
    case "declined":
      return "Declined";
    default:
      return status;
  }
}

export function adminActionSuccessMessage(action: string): string {
  switch (action) {
    case "mark_under_review":
      return "Application marked as under review.";
    case "approve":
      return "Application approved.";
    case "approve_founding":
      return "Application approved as Founding Partner.";
    case "decline":
      return "Application declined.";
    case "suspend":
      return "Partner suspended.";
    case "reactivate":
      return "Partner reactivated.";
    case "set_founding":
      return "Partner level set to Founding.";
    case "set_standard":
      return "Partner level set to Standard.";
    case "adjust_amount":
      return "Reward amount updated.";
    case "approve_reward":
      return "Reward approved.";
    case "mark_paid":
      return "Reward marked as paid.";
    default:
      return "Update saved.";
  }
}

export function applyApplicationStatusUpdate(
  applications: AdminApplicationDetail[],
  applicationId: string,
  patch: Partial<AdminApplicationDetail>
): AdminApplicationDetail[] {
  return applications.map((app) =>
    app.id === applicationId ? { ...app, ...patch } : app
  );
}

export function formatAdminDate(value: string | null | undefined): string {
  if (!value?.trim()) return "Not provided.";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}
