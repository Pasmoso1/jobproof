import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PARTNER_STATUS_APPLY_HREF,
  PARTNER_STATUS_DASHBOARD_HREF,
  PARTNER_STATUS_LOGIN_HREF,
  PARTNER_STATUS_PROGRAM_HREF,
  buildPartnerStatusPageView,
} from "@/lib/partners/partner-status-view";

describe("partner status page view", () => {
  it("shows signed-out sign-in instructions", () => {
    const view = buildPartnerStatusPageView({
      signedIn: false,
      signedInEmail: null,
      status: null,
    });
    assert.equal(view.title, "Sign in to view your partner application");
    assert.match(
      view.paragraphs[0] ?? "",
      /username or email and password you selected/i
    );
    assert.equal(view.actions[0]?.label, "Sign in to check status");
    assert.equal(view.actions[0]?.href, PARTNER_STATUS_LOGIN_HREF);
    assert.match(PARTNER_STATUS_LOGIN_HREF, /next=%2Fpartner%2Fstatus/);
    assert.equal(view.actions[1]?.href, PARTNER_STATUS_APPLY_HREF);
    assert.equal(view.showSignedInBanner, false);
  });

  it("shows submitted status for a matching submitted application", () => {
    const view = buildPartnerStatusPageView({
      signedIn: true,
      signedInEmail: "partner@example.com",
      status: {
        kind: "application",
        status: "submitted",
        organizationName: "Acme Partners",
        username: "acmepartner",
        emailVerified: true,
      },
    });
    assert.equal(view.title, "Application submitted");
    assert.match(view.paragraphs.join(" "), /Acme Partners/);
    assert.ok(
      !view.actions.some((a) => a.kind === "sign_in_another_account")
    );
  });

  it("shows under-review status for a matching under_review application", () => {
    const view = buildPartnerStatusPageView({
      signedIn: true,
      signedInEmail: "partner@example.com",
      status: {
        kind: "application",
        status: "under_review",
        organizationName: "Acme Partners",
        username: null,
        emailVerified: true,
      },
    });
    assert.equal(view.title, "Application under review");
    assert.match(view.paragraphs.join(" "), /under review/i);
  });

  it("shows wrong-account explanation without claiming no application exists", () => {
    const view = buildPartnerStatusPageView({
      signedIn: true,
      signedInEmail: "contractor@example.com",
      status: { kind: "none", emailVerified: true },
    });
    assert.equal(
      view.title,
      "We can’t find a partner application for the account currently signed in"
    );
    assert.match(
      view.paragraphs.join(" "),
      /may be linked to a different JobProof username or email/i
    );
    assert.match(
      view.paragraphs.join(" "),
      /If you have not applied yet/i
    );
    assert.doesNotMatch(
      view.title + view.paragraphs.join(" "),
      /No partner application on this account/i
    );
    assert.doesNotMatch(
      view.paragraphs.join(" "),
      /This account is not linked to a JobProof partner application/i
    );
    assert.equal(view.showSignedInBanner, true);
    assert.equal(view.signedInEmail, "contractor@example.com");
    assert.equal(view.actions[0]?.kind, "sign_in_another_account");
    assert.equal(view.actions[0]?.label, "Sign in with another account");
    assert.equal(view.actions[1]?.href, PARTNER_STATUS_APPLY_HREF);
    assert.equal(view.actions[2]?.href, PARTNER_STATUS_DASHBOARD_HREF);
    assert.equal(view.actions[3]?.href, PARTNER_STATUS_PROGRAM_HREF);
    assert.equal(view.actions[3]?.variant, "text");
  });

  it("puts account-switch ahead of apply for wrong-account state", () => {
    const view = buildPartnerStatusPageView({
      signedIn: true,
      signedInEmail: "a@b.com",
      status: { kind: "none", emailVerified: false },
    });
    assert.equal(view.actions[0]?.kind, "sign_in_another_account");
    assert.equal(view.actions[1]?.label, "Apply to Partner Program");
    assert.ok(!view.actions.some((a) => a.label === "Apply now"));
  });
});

describe("partner status page wiring and lookup", () => {
  it("status page uses trusted session lookup helpers and wrong-account UI", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/(partner)/partner/status/page.tsx"),
      "utf8"
    );
    assert.match(source, /getPartnerAccountStatusForCurrentUser/);
    assert.match(source, /buildPartnerStatusPageView/);
    assert.match(source, /SignInWithAnotherAccountButton/);
    assert.match(source, /You are currently signed in as/);
    assert.doesNotMatch(source, /searchParams/);
    assert.doesNotMatch(source, /No partner application on this account/);
    assert.doesNotMatch(source, /Apply now/);
  });

  it("sign-in-with-another-account signs out and preserves next=/partner/status", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/components/partners/sign-in-with-another-account-button.tsx"
      ),
      "utf8"
    );
    assert.match(source, /signOut/);
    assert.match(source, /PARTNER_STATUS_LOGIN_HREF/);
    assert.match(source, /router\.replace/);
  });

  it("session lookup prefers auth_user_id and supports legacy null-auth email fallback", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/partners/session.ts"),
      "utf8"
    );
    assert.match(source, /\.eq\("auth_user_id", user\.id\)/);
    assert.match(source, /\.ilike\("email", email\)/);
    assert.match(source, /\.is\("auth_user_id", null\)/);
    assert.match(source, /partner_applications/);
    assert.doesNotMatch(source, /searchParams/);
    assert.doesNotMatch(source, /query\./);
  });

  it("partner section layout no longer forces login away from status", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/(partner)/partner/layout.tsx"),
      "utf8"
    );
    assert.doesNotMatch(source, /redirect\("\/login\?next=\/partner"\)/);
  });

  it("confirmation email status link stays on /partner/status without sensitive query params", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/partners/emails.ts"),
      "utf8"
    );
    assert.match(source, /\/partner\/status/);
    assert.match(source, /View application status/);
    assert.doesNotMatch(source, /partner\/status\?/);
    assert.doesNotMatch(source, /application_id=/);
    assert.doesNotMatch(source, /auth_user_id=/);
  });
});
