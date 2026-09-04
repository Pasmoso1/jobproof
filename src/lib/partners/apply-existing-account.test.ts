import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PARTNER_EXISTING_ACCOUNT_BODY,
  PARTNER_EXISTING_ACCOUNT_PRIMARY_CTA,
  PARTNER_EXISTING_ACCOUNT_TITLE,
  partnerExistingAccountBody,
  partnerExistingAccountLoginHref,
  partnerExistingAccountLoginNext,
  emailApplyBlockerToContinueKind,
} from "@/lib/partners/apply-existing-account";
import {
  ORGANIZATION_APPLY_LOGIN_NEXT,
  PARTNER_APPLY_LOGIN_NEXT,
} from "@/lib/partners/application-draft";
import { PARTNER_PROGRAM_LOGIN_NEXT } from "@/lib/partners/login-href";
import {
  createPartnerAuthUserViaSignUp,
  isEmailAlreadyRegisteredError,
} from "@/lib/partners/auth-account";
import {
  submitPartnerApplicationCore,
  type PartnerApplicationInsertClient,
} from "@/lib/partners/submit-application";

function validFormData(overrides?: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("organization_name", "Acme Partners");
  fd.set("contact_name", "Jordan Lee");
  fd.set("email", "jordan@example.com");
  fd.set("partner_type", "creator");
  fd.set("primary_platform", "youtube");
  fd.set("website", "https://youtube.com/@acme");
  fd.set("estimated_audience", "5000 subscribers");
  fd.set("promotion_plan", "Share with my contractor network.");
  fd.set("reason", "I make contractor how-to videos.");
  fd.set("agreement_accepted", "on");
  fd.set("username", "jordanlee");
  fd.set("password", "secret12");
  fd.set("confirm_password", "secret12");
  fd.set("company_website", "");
  for (const [key, value] of Object.entries(overrides ?? {})) {
    fd.set(key, value);
  }
  return fd;
}

function createInsertClient(): PartnerApplicationInsertClient & {
  lastRow: Record<string, unknown> | null;
} {
  const state = { lastRow: null as Record<string, unknown> | null };
  return {
    get lastRow() {
      return state.lastRow;
    },
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        state.lastRow = row;
        return { error: null };
      },
    }),
  };
}

describe("partner existing-account apply UX", () => {
  it("uses intentional sign-in copy without technical auth jargon", () => {
    assert.equal(PARTNER_EXISTING_ACCOUNT_TITLE, "Sign in to continue");
    assert.match(PARTNER_EXISTING_ACCOUNT_BODY, /already associated with a JobProof account/i);
    assert.equal(PARTNER_EXISTING_ACCOUNT_PRIMARY_CTA, "Sign in to continue");
    assert.doesNotMatch(PARTNER_EXISTING_ACCOUNT_BODY, /supabase|auth user|RLS|duplicate identity/i);
    assert.doesNotMatch(PARTNER_EXISTING_ACCOUNT_BODY, /https:\/\//i);
  });

  it("routes Auth-only continue back to apply, and known apps to Partner entry", () => {
    assert.equal(
      partnerExistingAccountLoginNext("existing_account", PARTNER_APPLY_LOGIN_NEXT),
      PARTNER_APPLY_LOGIN_NEXT
    );
    assert.equal(
      partnerExistingAccountLoginNext(
        "existing_account",
        ORGANIZATION_APPLY_LOGIN_NEXT
      ),
      ORGANIZATION_APPLY_LOGIN_NEXT
    );
    assert.equal(
      partnerExistingAccountLoginNext(
        "existing_application",
        PARTNER_APPLY_LOGIN_NEXT
      ),
      PARTNER_PROGRAM_LOGIN_NEXT
    );
    assert.equal(
      partnerExistingAccountLoginNext("existing_partner", PARTNER_APPLY_LOGIN_NEXT),
      PARTNER_PROGRAM_LOGIN_NEXT
    );
    assert.match(
      partnerExistingAccountLoginHref("existing_account", PARTNER_APPLY_LOGIN_NEXT),
      /next=%2Fpartners%2Fapply/
    );
    assert.match(
      partnerExistingAccountLoginHref(
        "existing_account",
        ORGANIZATION_APPLY_LOGIN_NEXT
      ),
      /next=%2Fpartners%2Forganizations%2Fapply/
    );
    assert.equal(
      emailApplyBlockerToContinueKind({ kind: "active_partner" }),
      "existing_partner"
    );
    assert.match(partnerExistingAccountBody("existing_application"), /already on file/i);
  });

  it("detects existing Auth email via signUp identities without exposing user ids", async () => {
    const created = await createPartnerAuthUserViaSignUp({
      authClient: {
        auth: {
          signUp: async () => ({
            data: {
              user: {
                id: "should-not-leak",
                identities: [],
                email_confirmed_at: null,
              },
            },
            error: null,
          }),
        },
      } as never,
      email: "existing@example.com",
      password: "secret12",
      username: "existinguser",
    });
    assert.equal(created.ok, false);
    if (created.ok) return;
    assert.equal(created.existingAccount, true);
    assert.match(created.error, /already associated with a JobProof account/i);
    assert.doesNotMatch(created.error, /should-not-leak|user id|auth_user/i);
  });

  it("classifies registered-email Auth errors safely", () => {
    assert.equal(
      isEmailAlreadyRegisteredError("User already registered"),
      true
    );
    assert.equal(isEmailAlreadyRegisteredError("rate limit exceeded"), false);
  });

  it("signed-out existing Auth email does not insert or claim a username", async () => {
    const client = createInsertClient();
    const claimed: string[] = [];
    const released: string[] = [];
    let provisionCalled = false;

    const result = await submitPartnerApplicationCore({
      formData: validFormData(),
      insertClient: client,
      checkUsernameAvailable: async () => true,
      provisionAuthUser: async () => {
        provisionCalled = true;
        return {
          ok: false as const,
          error: PARTNER_EXISTING_ACCOUNT_BODY,
          code: "existing_account" as const,
        };
      },
      claimUsername: async (args) => {
        claimed.push(args.normalized);
        return { ok: true as const };
      },
      releaseUsernameClaim: async (normalized) => {
        released.push(normalized);
      },
    });

    assert.equal(result.success, false);
    if (result.success) return;
    assert.equal(result.code, "existing_account");
    assert.equal(provisionCalled, true);
    assert.equal(client.lastRow, null);
    assert.deepEqual(claimed, []);
    assert.deepEqual(released, []);
  });

  it("signed-out open application returns sign-in continue state", async () => {
    const client = createInsertClient();
    let provisionCalled = false;
    const result = await submitPartnerApplicationCore({
      formData: validFormData(),
      insertClient: client,
      findEmailApplyBlocker: async () => ({ kind: "open_application" }),
      checkUsernameAvailable: async () => true,
      provisionAuthUser: async () => {
        provisionCalled = true;
        return {
          ok: true as const,
          userId: "x",
          emailConfirmedAt: null,
          createdNewAuthUser: true,
        };
      },
      claimUsername: async () => ({ ok: true as const }),
      releaseUsernameClaim: async () => {},
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.equal(result.code, "existing_application");
    assert.equal(provisionCalled, false);
    assert.equal(client.lastRow, null);
  });

  it("signed-out active partner returns partner continue state", async () => {
    const client = createInsertClient();
    const result = await submitPartnerApplicationCore({
      formData: validFormData(),
      insertClient: client,
      findEmailApplyBlocker: async () => ({ kind: "active_partner" }),
      checkUsernameAvailable: async () => true,
      provisionAuthUser: async () => ({
        ok: true as const,
        userId: "x",
        emailConfirmedAt: null,
        createdNewAuthUser: true,
      }),
      claimUsername: async () => ({ ok: true as const }),
      releaseUsernameClaim: async () => {},
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.equal(result.code, "existing_partner");
    assert.equal(client.lastRow, null);
  });

  it("signed-in open application is blocked without creating another row", async () => {
    const client = createInsertClient();
    const result = await submitPartnerApplicationCore({
      formData: validFormData({ password: "", confirm_password: "" }),
      insertClient: client,
      authenticatedUser: {
        id: "existing-user",
        email: "jordan@example.com",
        emailConfirmedAt: "2026-01-01T00:00:00.000Z",
      },
      findEmailApplyBlocker: async () => ({ kind: "open_application" }),
      checkUsernameAvailable: async () => true,
      provisionAuthUser: async () => ({
        ok: true as const,
        userId: "should-not",
        emailConfirmedAt: null,
        createdNewAuthUser: true,
      }),
      claimUsername: async () => ({ ok: true as const }),
      releaseUsernameClaim: async () => {},
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.equal(result.code, "duplicate_application");
    assert.equal(client.lastRow, null);
  });

  it("new-account flow still succeeds for brand-new emails", async () => {
    const client = createInsertClient();
    const claimed: string[] = [];
    const result = await submitPartnerApplicationCore({
      formData: validFormData(),
      insertClient: client,
      findEmailApplyBlocker: async () => null,
      checkUsernameAvailable: async () => true,
      provisionAuthUser: async () => ({
        ok: true as const,
        userId: "auth-new",
        emailConfirmedAt: null,
        createdNewAuthUser: true,
      }),
      claimUsername: async (args) => {
        claimed.push(args.normalized);
        return { ok: true as const };
      },
      releaseUsernameClaim: async () => {},
    });
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.flow, "new_account");
    assert.equal(client.lastRow?.auth_user_id, "auth-new");
    assert.deepEqual(claimed, ["jordanlee"]);
  });

  it("organization apply pages wire the same continue panel and return paths", () => {
    const apply = readFileSync(
      join(process.cwd(), "src/app/partners/apply/page.tsx"),
      "utf8"
    );
    const org = readFileSync(
      join(process.cwd(), "src/app/partners/organizations/apply/page.tsx"),
      "utf8"
    );
    const panel = readFileSync(
      join(
        process.cwd(),
        "src/components/partners/existing-account-continue-panel.tsx"
      ),
      "utf8"
    );
    for (const source of [apply, org]) {
      assert.match(source, /ExistingAccountContinuePanel/);
      assert.match(source, /existing_account/);
      assert.match(source, /existing_application/);
      assert.match(source, /existing_partner/);
      assert.match(source, /redirectTo/);
    }
    assert.match(apply, /PARTNER_APPLY_LOGIN_NEXT/);
    assert.match(org, /ORGANIZATION_APPLY_LOGIN_NEXT/);
    assert.match(panel, /PARTNER_EXISTING_ACCOUNT_FORGOT_PASSWORD/);
    assert.match(panel, /PARTNER_EXISTING_ACCOUNT_PRIMARY_CTA/);
    assert.match(panel, /PARTNER_EXISTING_ACCOUNT_TITLE/);
  });
});
