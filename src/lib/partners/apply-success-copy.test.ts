import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PARTNER_APPLY_LOGIN_STATUS_HREF,
  PARTNER_APPLY_PAGE_INTRO,
  PARTNER_APPLY_PAGE_TITLE,
  PARTNER_APPLY_STATUS_PATH,
  PARTNER_APPLY_SUCCESS_CTA_RETURN,
  PARTNER_APPLY_SUCCESS_CTA_STATUS,
  PARTNER_APPLY_SUCCESS_HEADING,
  getPartnerApplyStatusCheckHref,
  getPartnerApplySuccessCopy,
} from "@/lib/partners/apply-success-copy";

describe("partner apply success copy", () => {
  it("uses the required page title and intro", () => {
    assert.equal(PARTNER_APPLY_PAGE_TITLE, "Apply to become a partner");
    assert.match(PARTNER_APPLY_PAGE_INTRO, /create your JobProof account/i);
    assert.match(PARTNER_APPLY_PAGE_INTRO, /check your application status/i);
    assert.match(
      PARTNER_APPLY_PAGE_INTRO,
      /Partner Portal access will open after approval/i
    );
    assert.doesNotMatch(
      PARTNER_APPLY_PAGE_INTRO,
      /set up Partner Portal sign-in for after approval/i
    );
  });

  it("shows new-account success copy that separates status from portal access", () => {
    const copy = getPartnerApplySuccessCopy("new_account");
    assert.equal(copy.heading, PARTNER_APPLY_SUCCESS_HEADING);
    assert.equal(copy.heading, "Application submitted");
    assert.ok(
      copy.paragraphs.some((p) =>
        p.includes("Your JobProof account is ready")
      )
    );
    assert.ok(
      copy.paragraphs.some((p) =>
        p.includes(
          "sign in with the username or email and password you chose during the application"
        )
      )
    );
    assert.ok(
      copy.paragraphs.some((p) =>
        p.includes(
          "Partner Portal will automatically become available once your application has been approved"
        )
      )
    );
    assert.ok(
      !copy.paragraphs.some((p) =>
        p.includes("Your existing JobProof account is linked")
      )
    );
  });

  it("shows existing-account success copy without claiming a new account", () => {
    const copy = getPartnerApplySuccessCopy("existing_account");
    assert.equal(copy.heading, "Application submitted");
    assert.ok(
      copy.paragraphs.some((p) =>
        p.includes(
          "Your existing JobProof account is linked to this application"
        )
      )
    );
    assert.ok(
      !copy.paragraphs.some((p) => p.includes("Your JobProof account is ready"))
    );
    assert.ok(
      copy.paragraphs.some((p) =>
        p.includes(
          "Partner Portal will automatically become available once your application has been approved"
        )
      )
    );
  });

  it("uses the required CTA labels", () => {
    assert.equal(PARTNER_APPLY_SUCCESS_CTA_STATUS, "Check application status");
    assert.equal(PARTNER_APPLY_SUCCESS_CTA_RETURN, "Return to Partner Program");
  });

  it("routes signed-out users through login with next=/partner/status", () => {
    assert.equal(
      getPartnerApplyStatusCheckHref(false),
      PARTNER_APPLY_LOGIN_STATUS_HREF
    );
    assert.match(PARTNER_APPLY_LOGIN_STATUS_HREF, /next=%2Fpartner%2Fstatus/);
    assert.doesNotMatch(PARTNER_APPLY_LOGIN_STATUS_HREF, /next=%2Fpartner$/);
  });

  it("routes signed-in applicants directly to /partner/status, not the portal dashboard", () => {
    assert.equal(
      getPartnerApplyStatusCheckHref(true),
      PARTNER_APPLY_STATUS_PATH
    );
    assert.equal(PARTNER_APPLY_STATUS_PATH, "/partner/status");
    assert.notEqual(getPartnerApplyStatusCheckHref(true), "/partner");
  });
});

describe("partner apply page success wiring", () => {
  it("wires success copy helpers and removes contradictory legacy copy", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/partners/apply/page.tsx"),
      "utf8"
    );
    assert.match(source, /getPartnerApplySuccessCopy/);
    assert.match(source, /getPartnerApplyStatusCheckHref/);
    assert.match(source, /PARTNER_APPLY_SUCCESS_CTA_STATUS/);
    assert.match(source, /PARTNER_APPLY_SUCCESS_CTA_RETURN/);
    assert.match(source, /submittedFlow/);
    assert.doesNotMatch(source, /Sign in to check status/);
    assert.doesNotMatch(source, /Back to Partner Program/);
    assert.doesNotMatch(
      source,
      /set up Partner Portal sign-in for\s+after approval/
    );
    assert.doesNotMatch(
      source,
      /then sign in with your username or email to check application status/
    );
    // Pending applicants must not be sent to the active portal dashboard CTA.
    assert.doesNotMatch(
      source,
      /href=\{[`'"]\/partner[`'"]\}/
    );
  });
});
