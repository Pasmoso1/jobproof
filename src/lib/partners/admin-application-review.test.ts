import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminActionSuccessMessage,
  applyApplicationStatusUpdate,
  displayOptionalAdminValue,
  getApplicationReviewActions,
  hasValidAgreementAcceptance,
  websiteHref,
  type AdminApplicationDetail,
} from "@/lib/partners/admin-application-review";

function sampleApp(
  overrides?: Partial<AdminApplicationDetail>
): AdminApplicationDetail {
  return {
    id: "app-1",
    organization_name: "Acme Partners",
    contact_name: "Jordan Lee",
    email: "jordan@example.com",
    phone: "4165551234",
    website: "example.com",
    partner_type: "Influencer",
    estimated_audience: "500 contractors",
    promotion_plan: "Line one\n\nLine two",
    reason: "Because contractors need better tools.",
    status: "submitted",
    submitted_at: "2026-07-01T12:00:00.000Z",
    reviewed_at: null,
    reviewed_by: null,
    decline_reason: null,
    agreement_version: "2026-07-01",
    agreement_accepted_at: "2026-07-01T12:05:00.000Z",
    created_partner_id: null,
    username: "jordanlee",
    auth_user_id: "auth-1",
    email_confirmed_at: "2026-07-01T12:10:00.000Z",
    email_verified: true,
    auth_account_linked: true,
    legacy_account: false,
    ...overrides,
  };
}

describe("admin application review helpers", () => {
  it("shows Not provided for missing optional fields", () => {
    assert.equal(displayOptionalAdminValue(null), "Not provided.");
    assert.equal(displayOptionalAdminValue("   "), "Not provided.");
    assert.equal(displayOptionalAdminValue("416-555-1234"), "416-555-1234");
  });

  it("builds website hrefs for bare domains", () => {
    assert.equal(websiteHref("example.com"), "https://example.com");
    assert.equal(websiteHref("https://secure.example"), "https://secure.example");
    assert.equal(websiteHref(null), null);
  });

  it("exposes Mark under review only for submitted status", () => {
    const submitted = getApplicationReviewActions("submitted");
    assert.equal(submitted.canMarkUnderReview, true);
    assert.equal(submitted.showUnderReviewBadge, false);
    assert.equal(submitted.canApprove, true);
    assert.equal(submitted.canDecline, true);
  });

  it("shows a non-clickable under-review indicator for under_review status", () => {
    const underReview = getApplicationReviewActions("under_review");
    assert.equal(underReview.canMarkUnderReview, false);
    assert.equal(underReview.showUnderReviewBadge, true);
    assert.equal(underReview.canApprove, true);
    assert.equal(underReview.canDecline, true);
  });

  it("hides invalid actions for approved status", () => {
    const approved = getApplicationReviewActions("approved");
    assert.equal(approved.canMarkUnderReview, false);
    assert.equal(approved.canApprove, false);
    assert.equal(approved.canDecline, false);
    assert.equal(approved.showApprovedState, true);
  });

  it("hides invalid actions for declined status", () => {
    const declined = getApplicationReviewActions("declined");
    assert.equal(declined.canMarkUnderReview, false);
    assert.equal(declined.canApprove, false);
    assert.equal(declined.canDecline, false);
    assert.equal(declined.showDeclinedState, true);
  });

  it("refreshes displayed status immediately after an action patch", () => {
    const apps = [sampleApp({ status: "submitted" })];
    const next = applyApplicationStatusUpdate(apps, "app-1", {
      status: "under_review",
    });
    assert.equal(next[0]?.status, "under_review");
    assert.equal(getApplicationReviewActions(next[0]!.status).canMarkUnderReview, false);
    assert.equal(getApplicationReviewActions(next[0]!.status).showUnderReviewBadge, true);
  });

  it("requires agreement acceptance before approval is allowed by policy", () => {
    assert.equal(
      hasValidAgreementAcceptance({
        agreement_version: "2026-07-01",
        agreement_accepted_at: "2026-07-01T12:00:00.000Z",
      }),
      true
    );
    assert.equal(
      hasValidAgreementAcceptance({
        agreement_version: null,
        agreement_accepted_at: null,
      }),
      false
    );
  });

  it("uses natural success wording for mark under review", () => {
    assert.equal(
      adminActionSuccessMessage("mark_under_review"),
      "Application marked as under review."
    );
  });

  it("preserves full application detail fields for display", () => {
    const app = sampleApp({
      phone: null,
      website: null,
      estimated_audience: null,
      promotion_plan: "First paragraph.\n\nSecond paragraph.",
      reason: "Need better workflow.",
    });
    assert.equal(displayOptionalAdminValue(app.phone), "Not provided.");
    assert.equal(displayOptionalAdminValue(app.website), "Not provided.");
    assert.equal(displayOptionalAdminValue(app.estimated_audience), "Not provided.");
    assert.match(app.promotion_plan, /\n\n/);
    assert.equal(app.organization_name, "Acme Partners");
    assert.equal(app.contact_name, "Jordan Lee");
    assert.equal(app.email, "jordan@example.com");
    assert.equal(app.partner_type, "Influencer");
    assert.equal(app.reason, "Need better workflow.");
  });
});
