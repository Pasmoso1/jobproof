import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PARTNER_AGREEMENT_VERSION } from "@/lib/partners/constants";
import {
  buildPartnerApplicationInsertRow,
  insertPartnerApplicationWithoutSelect,
  mapPartnerApplicationInsertError,
  parsePartnerApplicationFormData,
  submitPartnerApplicationCore,
  type PartnerApplicationInsertClient,
} from "@/lib/partners/submit-application";

function validFormData(overrides?: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("organization_name", "Acme Partners");
  fd.set("contact_name", "Jordan Lee");
  fd.set("email", "jordan@example.com");
  fd.set("phone", "");
  fd.set("website", "");
  fd.set("partner_type", "influencer");
  fd.set("estimated_audience", "");
  fd.set("promotion_plan", "Share with my contractor network.");
  fd.set("reason", "I work with many independent contractors.");
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

function createInsertClient(options?: {
  error?: { code?: string; message?: string; details?: string; hint?: string } | null;
  onInsert?: (row: Record<string, unknown>) => void;
  rejectSelect?: boolean;
}): PartnerApplicationInsertClient & {
  lastRow: Record<string, unknown> | null;
  selectCalled: boolean;
} {
  const state = {
    lastRow: null as Record<string, unknown> | null,
    selectCalled: false,
  };

  const client: PartnerApplicationInsertClient & typeof state = {
    ...state,
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        state.lastRow = row;
        client.lastRow = row;
        options?.onInsert?.(row);
        const result = {
          error: options?.error ?? null,
          select: () => {
            state.selectCalled = true;
            client.selectCalled = true;
            if (options?.rejectSelect) {
              throw new Error("SELECT is not permitted for anonymous insert");
            }
            return {
              maybeSingle: async () => ({
                data: null,
                error: {
                  code: "42501",
                  message: "permission denied for table partner_applications",
                },
              }),
            };
          },
        };
        return result;
      },
    }),
  };

  return client;
}

function authHooks(overrides?: {
  usernameTakenOnClaim?: boolean;
  insertFails?: boolean;
  provisionFails?: boolean;
  existingAccount?: boolean;
}) {
  const claimed: string[] = [];
  const released: string[] = [];
  const deletedUsers: string[] = [];
  let created = false;

  return {
    claimed,
    released,
    deletedUsers,
    get created() {
      return created;
    },
    hooks: {
      checkUsernameAvailable: async () => !overrides?.usernameTakenOnClaim,
      provisionAuthUser: async () => {
        if (overrides?.existingAccount) {
          return {
            ok: false as const,
            error: "An account with this email already exists.",
            code: "existing_account" as const,
          };
        }
        if (overrides?.provisionFails) {
          return {
            ok: false as const,
            error: "Could not create your account.",
            code: "auth_failed" as const,
          };
        }
        created = true;
        return {
          ok: true as const,
          userId: "auth-user-1",
          emailConfirmedAt: null,
          createdNewAuthUser: true,
        };
      },
      claimUsername: async (args: {
        username: string;
        normalized: string;
        authUserId: string;
        applicationId: string;
      }) => {
        claimed.push(args.normalized);
        if (overrides?.usernameTakenOnClaim) {
          return { ok: false as const, error: "taken", code: "23505" };
        }
        return { ok: true as const };
      },
      releaseUsernameClaim: async (normalized: string) => {
        released.push(normalized);
      },
      deleteOrphanAuthUser: async (userId: string) => {
        deletedUsers.push(userId);
      },
      linkRegistryApplication: async () => undefined,
    },
  };
}

describe("submitPartnerApplicationCore", () => {
  it("creates username/password account fields and inserts without SELECT", async () => {
    const client = createInsertClient({ rejectSelect: true });
    const now = new Date("2026-07-20T14:00:00.000Z");
    const auth = authHooks();

    const result = await submitPartnerApplicationCore({
      formData: validFormData(),
      insertClient: client,
      now,
      ...auth.hooks,
    });

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.ok(result.applicationId);
    assert.equal(client.selectCalled, false);
    assert.equal(client.lastRow?.username, "jordanlee");
    assert.equal(client.lastRow?.normalized_username, "jordanlee");
    assert.equal(client.lastRow?.auth_user_id, "auth-user-1");
    assert.equal(client.lastRow?.agreement_version, PARTNER_AGREEMENT_VERSION);
    assert.equal("password" in (client.lastRow ?? {}), false);
    assert.equal("confirm_password" in (client.lastRow ?? {}), false);
    assert.ok(!JSON.stringify(client.lastRow).includes("secret12"));
  });

  it("rejects password confirmation mismatch", async () => {
    const client = createInsertClient();
    const auth = authHooks();
    const result = await submitPartnerApplicationCore({
      formData: validFormData({ confirm_password: "other" }),
      insertClient: client,
      ...auth.hooks,
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.ok(result.fieldErrors?.password || result.fieldErrors?.confirm_password);
  });

  it("rejects reserved username", async () => {
    const client = createInsertClient();
    const auth = authHooks();
    const result = await submitPartnerApplicationCore({
      formData: validFormData({ username: "admin" }),
      insertClient: client,
      ...auth.hooks,
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.match(result.fieldErrors?.username ?? result.error, /reserved/i);
  });

  it("rejects invalid username", async () => {
    const client = createInsertClient();
    const auth = authHooks();
    const result = await submitPartnerApplicationCore({
      formData: validFormData({ username: "_bad" }),
      insertClient: client,
      ...auth.hooks,
    });
    assert.equal(result.success, false);
  });

  it("handles username race on claim and deletes orphan auth user", async () => {
    const client = createInsertClient();
    const auth = authHooks({ usernameTakenOnClaim: true });
    // checkUsernameAvailable returns true first, claim fails with 23505
    auth.hooks.checkUsernameAvailable = async () => true;

    const result = await submitPartnerApplicationCore({
      formData: validFormData(),
      insertClient: client,
      ...auth.hooks,
    });

    assert.equal(result.success, false);
    if (result.success) return;
    assert.equal(result.code, "username_taken");
    assert.deepEqual(auth.deletedUsers, ["auth-user-1"]);
  });

  it("rolls back auth user when application insert fails", async () => {
    const client = createInsertClient({
      error: { code: "23505", message: "duplicate key", details: "email" },
    });
    const auth = authHooks();
    const result = await submitPartnerApplicationCore({
      formData: validFormData(),
      insertClient: client,
      ...auth.hooks,
    });
    assert.equal(result.success, false);
    assert.deepEqual(auth.released, ["jordanlee"]);
    assert.deepEqual(auth.deletedUsers, ["auth-user-1"]);
  });

  it("requires sign-in when email already has an Auth account", async () => {
    const client = createInsertClient();
    const auth = authHooks({ existingAccount: true });
    const result = await submitPartnerApplicationCore({
      formData: validFormData(),
      insertClient: client,
      ...auth.hooks,
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.equal(result.code, "existing_account");
  });

  it("links authenticated existing account without creating a new Auth user", async () => {
    const client = createInsertClient();
    const auth = authHooks();
    let provisionCalled = false;
    auth.hooks.provisionAuthUser = async () => {
      provisionCalled = true;
      return {
        ok: false as const,
        error: "should not provision",
        code: "auth_failed" as const,
      };
    };

    const result = await submitPartnerApplicationCore({
      formData: validFormData({ password: "", confirm_password: "" }),
      insertClient: client,
      authenticatedUser: {
        id: "existing-user",
        email: "jordan@example.com",
        emailConfirmedAt: "2026-01-01T00:00:00.000Z",
      },
      ...auth.hooks,
    });

    assert.equal(result.success, true);
    assert.equal(provisionCalled, false);
    assert.equal(client.lastRow?.auth_user_id, "existing-user");
    assert.equal(auth.deletedUsers.length, 0);
  });

  it("accepts email as login identifier without claiming a username", async () => {
    const client = createInsertClient();
    const auth = authHooks();
    let claimCalled = false;
    auth.hooks.claimUsername = async () => {
      claimCalled = true;
      return { ok: true as const };
    };

    const result = await submitPartnerApplicationCore({
      formData: validFormData({ username: "jordan@example.com" }),
      insertClient: client,
      ...auth.hooks,
    });

    assert.equal(result.success, true);
    assert.equal(claimCalled, false);
    assert.equal(client.lastRow?.username, null);
    assert.equal(client.lastRow?.normalized_username, null);
    assert.equal(client.lastRow?.auth_user_id, "auth-user-1");
  });

  it("silently accepts honeypot submissions without inserting", async () => {
    const client = createInsertClient();
    const auth = authHooks();
    const result = await submitPartnerApplicationCore({
      formData: validFormData({ company_website: "http://spam.test" }),
      insertClient: client,
      ...auth.hooks,
    });
    assert.equal(result.success, true);
    assert.equal(client.lastRow, null);
  });

  it("maps username unique violations", () => {
    const mapped = mapPartnerApplicationInsertError({
      code: "23505",
      message: "duplicate key value violates unique constraint",
      details: "Key (normalized_username)=(jordanlee) already exists.",
    });
    assert.equal(mapped.success, false);
    if (mapped.success) return;
    assert.equal(mapped.code, "username_taken");
  });
});

describe("buildPartnerApplicationInsertRow", () => {
  it("never includes password fields", () => {
    const parsed = parsePartnerApplicationFormData(validFormData());
    const row = buildPartnerApplicationInsertRow(parsed, {
      username: "jordanlee",
      normalizedUsername: "jordanlee",
      authUserId: "u1",
    });
    assert.equal("password" in row, false);
    assert.ok(!JSON.stringify(row).toLowerCase().includes("secret"));
  });
});

describe("insertPartnerApplicationWithoutSelect", () => {
  it("returns application id from the insert row", async () => {
    const client = createInsertClient();
    const result = await insertPartnerApplicationWithoutSelect(client, {
      id: "app-1",
      email: "a@b.com",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.applicationId, "app-1");
  });
});
