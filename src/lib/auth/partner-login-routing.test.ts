import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isPartnerProgramDestination,
  isSafeRelativeRedirect,
  resolveAuthenticatedAuthPathRedirect,
  resolveSafeLoginRedirect,
} from "@/lib/auth/safe-redirect";
import { resolveContractorPostLoginPath } from "@/lib/auth/post-login-path";
import {
  PARTNER_PROGRAM_LOGIN_HREF,
  PARTNER_PROGRAM_LOGIN_NEXT,
  resolvePartnerEntryPath,
} from "@/lib/partners/login-href";

const INCOMPLETE_PROFILE = {
  business_name: null,
  phone: null,
  address_line_1: null,
  city: null,
  province: null,
  postal_code: null,
  quote_primary_trade: null,
  trial_plan_tier: "essential",
  plan_tier: null,
  stripe_subscription_id: null,
  subscription_status: null,
  beta_tester: false,
};

const COMPLETE_PROFILE = {
  business_name: "Acme Contracting",
  phone: "4165551212",
  address_line_1: "1 Main St",
  city: "Toronto",
  province: "ON",
  postal_code: "M5V1A1",
  quote_primary_trade: "plumbing",
  trial_plan_tier: "essential",
  plan_tier: null,
  stripe_subscription_id: null,
  subscription_status: null,
  beta_tester: false,
  trial_started_at: "2026-01-01T00:00:00.000Z",
  trial_ends_at: "2099-01-15T00:00:00.000Z",
  trial_expired_screen_seen_at: "2026-01-02T00:00:00.000Z",
};

describe("safe redirect helpers", () => {
  it("accepts valid internal Partner destinations", () => {
    assert.equal(isSafeRelativeRedirect("/partner"), true);
    assert.equal(isSafeRelativeRedirect("/partners/apply"), true);
    assert.equal(isSafeRelativeRedirect("/partner/status"), true);
    assert.equal(isPartnerProgramDestination("/partner"), true);
    assert.equal(isPartnerProgramDestination("/partners"), true);
    assert.equal(isPartnerProgramDestination("/partners/apply"), true);
    assert.equal(isPartnerProgramDestination("/partner/status?x=1"), true);
  });

  it("rejects external, protocol-relative, and unsafe schemes", () => {
    assert.equal(isSafeRelativeRedirect("https://external-site.com"), false);
    assert.equal(isSafeRelativeRedirect("//external-site.com"), false);
    assert.equal(isSafeRelativeRedirect("javascript:alert(1)"), false);
    assert.equal(isSafeRelativeRedirect("/partners/../evil"), false);
    assert.equal(isPartnerProgramDestination("https://evil.com"), false);
    assert.equal(isPartnerProgramDestination("//evil.com"), false);
  });

  it("resolveSafeLoginRedirect falls back for unsafe next", () => {
    assert.equal(resolveSafeLoginRedirect("/partner"), "/partner");
    assert.equal(
      resolveSafeLoginRedirect("https://external-site.com", "/dashboard"),
      "/dashboard"
    );
    assert.equal(resolveSafeLoginRedirect(null, "/dashboard"), "/dashboard");
  });
});

describe("Partner vs contractor post-login routing", () => {
  it("Partner Sign In href preserves next=/partner", () => {
    assert.equal(PARTNER_PROGRAM_LOGIN_NEXT, "/partner");
    assert.equal(
      PARTNER_PROGRAM_LOGIN_HREF,
      `/login?next=${encodeURIComponent("/partner")}`
    );
  });

  it("approved Partner entry opens portal", () => {
    assert.equal(
      resolvePartnerEntryPath({ kind: "active", emailVerified: true }),
      "/partner"
    );
  });

  it("pending applicant entry uses Partner status", () => {
    assert.equal(
      resolvePartnerEntryPath({ kind: "application", emailVerified: true }),
      "/partner/status"
    );
  });

  it("no Partner application entry goes to apply", () => {
    assert.equal(resolvePartnerEntryPath({ kind: "none" }), "/partners/apply");
  });

  it("declined applicant does not receive Partner Portal access", () => {
    assert.equal(
      resolvePartnerEntryPath({ kind: "application", emailVerified: true }),
      "/partner/status"
    );
    assert.notEqual(
      resolvePartnerEntryPath({ kind: "application", emailVerified: true }),
      "/partner"
    );
  });

  it("incomplete contractor profile does not override explicit Partner destination", () => {
    const contractorFallback = resolveContractorPostLoginPath(
      INCOMPLETE_PROFILE,
      "contractor@example.com"
    );
    assert.equal(contractorFallback, "/onboarding/business-profile");
    assert.equal(
      resolveAuthenticatedAuthPathRedirect({
        next: "/partner",
        contractorFallbackPath: contractorFallback,
      }),
      "/partner"
    );
    assert.equal(
      resolveAuthenticatedAuthPathRedirect({
        next: "/partners/apply",
        contractorFallbackPath: contractorFallback,
      }),
      "/partners/apply"
    );
  });

  it("normal JobProof login still sends incomplete profiles to contractor onboarding", () => {
    assert.equal(
      resolveContractorPostLoginPath(INCOMPLETE_PROFILE, "a@b.com"),
      "/onboarding/business-profile"
    );
    assert.equal(
      resolveAuthenticatedAuthPathRedirect({
        next: null,
        contractorFallbackPath: resolveContractorPostLoginPath(
          INCOMPLETE_PROFILE,
          "a@b.com"
        ),
      }),
      "/onboarding/business-profile"
    );
  });

  it("completed contractor account continues to dashboard on normal login", () => {
    assert.equal(
      resolveContractorPostLoginPath(COMPLETE_PROFILE, "a@b.com"),
      "/dashboard"
    );
    assert.equal(
      resolveAuthenticatedAuthPathRedirect({
        next: null,
        contractorFallbackPath: resolveContractorPostLoginPath(
          COMPLETE_PROFILE,
          "a@b.com"
        ),
      }),
      "/dashboard"
    );
  });

  it("non-Partner next does not bypass contractor fallback", () => {
    assert.equal(
      resolveAuthenticatedAuthPathRedirect({
        next: "/dashboard",
        contractorFallbackPath: "/onboarding/business-profile",
      }),
      "/onboarding/business-profile"
    );
  });
});

describe("Partner Sign In link wiring", () => {
  it("public Partner pages use PARTNER_PROGRAM_LOGIN_HREF", () => {
    for (const rel of [
      "src/app/partners/page.tsx",
      "src/app/partners/organizations/page.tsx",
      "src/app/partners/organizations/[slug]/page.tsx",
    ]) {
      const source = readFileSync(join(process.cwd(), rel), "utf8");
      assert.match(source, /PARTNER_PROGRAM_LOGIN_HREF/);
      assert.doesNotMatch(source, /href="\/login"/);
    }
  });

  it("middleware honors Partner next over contractor post-login path", () => {
    const source = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");
    assert.match(source, /resolveAuthenticatedAuthPathRedirect/);
    assert.match(source, /resolveContractorPostLoginPath/);
  });

  it("portal layout routes none applicants to apply via resolvePartnerEntryPath", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/(partner)/partner/(portal)/layout.tsx"),
      "utf8"
    );
    assert.match(source, /resolvePartnerEntryPath/);
    assert.match(source, /getPartnerAccountStatusForCurrentUser/);
  });

  it("login page sanitizes next with resolveSafeLoginRedirect", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/(auth)/login/page.tsx"),
      "utf8"
    );
    assert.match(source, /resolveSafeLoginRedirect/);
  });
});
