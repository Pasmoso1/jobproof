import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  deliverPartnerPasswordReset,
  findAuthUserByEmail,
  resolvePasswordResetRedirectTo,
  sanitizeDeliveryError,
  type RecoverySender,
} from "@/lib/admin/partner-password-reset";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
/** Source with comments removed, so explanatory history does not trip code assertions. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function recordingSender(result: Awaited<ReturnType<RecoverySender>> | Error) {
  const calls: Array<{ email: string; redirectTo: string }> = [];
  const send: RecoverySender = async (email, redirectTo) => {
    calls.push({ email, redirectTo });
    if (result instanceof Error) throw result;
    return result;
  };
  return { send, calls };
}

describe("password reset redirect is built only from the trusted app URL", () => {
  it("uses the https origin and the update-password callback", () => {
    const r = resolvePasswordResetRedirectTo("https://jobproof.ca", "production");
    assert.deepEqual(r, {
      ok: true,
      redirectTo: "https://jobproof.ca/auth/callback?next=%2Fupdate-password",
    });
  });

  it("drops credentials, paths and queries from the configured value", () => {
    const r = resolvePasswordResetRedirectTo("https://user:pw@jobproof.ca/some/path?x=1#h", "production");
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(new URL(r.redirectTo).origin, "https://jobproof.ca");
      assert.doesNotMatch(r.redirectTo, /user|pw|some\/path|x=1/);
    }
  });

  it("refuses insecure, malformed, or localhost-in-production URLs", () => {
    for (const bad of ["http://jobproof.ca", "ftp://jobproof.ca", "not a url", "", null, undefined]) {
      const r = resolvePasswordResetRedirectTo(bad as string | null | undefined, "production");
      assert.equal(r.ok, false, String(bad));
    }
    assert.equal(resolvePasswordResetRedirectTo("http://localhost:3000", "production").ok, false);
  });

  it("allows http://localhost only outside production", () => {
    const r = resolvePasswordResetRedirectTo("http://localhost:3000", "development");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.redirectTo, "http://localhost:3000/auth/callback?next=%2Fupdate-password");
  });
});

describe("partner password-reset delivery", () => {
  it("sends through the auth email sender and reports success only after it succeeds", async () => {
    const { send, calls } = recordingSender({ error: null });
    const result = await deliverPartnerPasswordReset({
      email: "  Partner@Example.COM ",
      appUrl: "https://jobproof.ca",
      send,
      nodeEnv: "production",
    });
    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].email, "partner@example.com");
    assert.equal(calls[0].redirectTo, "https://jobproof.ca/auth/callback?next=%2Fupdate-password");
  });

  it("does NOT report success when the provider rejects the request", async () => {
    const { send, calls } = recordingSender({ error: { message: "SMTP unavailable", status: 500 } });
    const result = await deliverPartnerPasswordReset({
      email: "partner@example.com",
      appUrl: "https://jobproof.ca",
      send,
      nodeEnv: "production",
    });
    assert.equal(calls.length, 1);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /could not be sent/i);
  });

  it("does NOT report success when sending throws", async () => {
    const { send } = recordingSender(new Error("network down https://x.supabase.co/auth?token=abcdefghijklmnopqrstuvwxyz0123456789"));
    const result = await deliverPartnerPasswordReset({
      email: "partner@example.com",
      appUrl: "https://jobproof.ca",
      send,
      nodeEnv: "production",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.doesNotMatch(result.error, /supabase\.co|token|abcdefghijkl/);
  });

  it("reports rate limiting clearly", async () => {
    const { send } = recordingSender({ error: { message: "x", code: "over_email_send_rate_limit", status: 429 } });
    const result = await deliverPartnerPasswordReset({
      email: "partner@example.com",
      appUrl: "https://jobproof.ca",
      send,
      nodeEnv: "production",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /rate-limited/i);
  });

  it("never sends when the email or app URL is unusable", async () => {
    const a = recordingSender({ error: null });
    const badEmail = await deliverPartnerPasswordReset({ email: "nope", appUrl: "https://jobproof.ca", send: a.send });
    assert.equal(badEmail.ok, false);
    const b = recordingSender({ error: null });
    const badUrl = await deliverPartnerPasswordReset({
      email: "partner@example.com",
      appUrl: "http://localhost:3000",
      send: b.send,
      nodeEnv: "production",
    });
    assert.equal(badUrl.ok, false);
    assert.equal(a.calls.length + b.calls.length, 0);
  });

  it("strips URLs and token-like strings from provider errors", () => {
    const msg = sanitizeDeliveryError({
      message: "failed for https://abc.supabase.co/auth/v1/verify?token=ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ please retry",
    });
    assert.doesNotMatch(msg, /https?:|ZZZZ/);
    assert.match(msg, /could not be sent/);
    assert.match(sanitizeDeliveryError(null), /could not be sent/);
  });
});

describe("findAuthUserByEmail (legacy applications without a linked account)", () => {
  const page = (users: Array<{ id: string; email: string }>) => async () => ({
    data: { users },
    error: null,
  });

  it("finds a user case-insensitively across pages", async () => {
    const pages = [
      Array.from({ length: 2 }, (_, i) => ({ id: `a${i}`, email: `a${i}@x.com` })),
      [{ id: "hit", email: "Partner@Example.com" }],
    ];
    const found = await findAuthUserByEmail(
      async (p) => ({ data: { users: pages[p - 1] ?? [] }, error: null }),
      "partner@example.com",
      { perPage: 2, maxPages: 5 }
    );
    assert.deepEqual(found, { id: "hit", email: "partner@example.com" });
  });

  it("returns null when absent, on error, and when the page cap is reached", async () => {
    assert.equal(await findAuthUserByEmail(page([{ id: "1", email: "other@x.com" }]), "partner@example.com"), null);
    assert.equal(
      await findAuthUserByEmail(async () => ({ data: null, error: new Error("boom") }), "partner@example.com"),
      null
    );
    let calls = 0;
    const full = async () => {
      calls += 1;
      return { data: { users: [{ id: "x", email: "z@x.com" }, { id: "y", email: "w@x.com" }] }, error: null };
    };
    assert.equal(await findAuthUserByEmail(full, "partner@example.com", { perPage: 2, maxPages: 3 }), null);
    assert.equal(calls, 3);
  });
});

describe("adminSendPartnerPasswordResetEmail implementation", () => {
  const actions = code(read("src/app/admin/partners/actions.ts"));
  const start = actions.indexOf("export async function adminSendPartnerPasswordResetEmail");
  const body = actions.slice(start);

  it("no longer uses generateLink (which sends nothing)", () => {
    assert.doesNotMatch(actions, /\.generateLink\(/);
    assert.doesNotMatch(body, /type:\s*"recovery"/);
  });

  it("delivers via the auth email sender and only returns ok after delivery succeeds", () => {
    assert.match(body, /createRecoveryEmailSender\(\)/);
    assert.match(body, /deliverPartnerPasswordReset\(/);
    const okAt = body.lastIndexOf("return { ok: true as const }");
    const guardAt = body.indexOf("if (!result.ok)");
    assert.ok(guardAt !== -1 && guardAt < okAt);
    assert.match(body, /return \{ ok: false as const, error: result\.error \}/);
  });

  it("builds the redirect from resolveAppUrl() only and never logs links or tokens", () => {
    assert.match(body, /appUrl: resolveAppUrl\(\)/);
    assert.doesNotMatch(body, /redirectTo/);
    for (const line of body.split("\n").filter((l) => l.includes("console."))) {
      assert.doesNotMatch(line, /token|link|url|redirect|email/i, line);
    }
    const lib = read("src/lib/admin/partner-password-reset.ts");
    assert.doesNotMatch(lib, /console\./);
    assert.doesNotMatch(lib, /SERVICE_ROLE/);
  });

  it("is audit-logged and still guarded by the admin allowlist", () => {
    assert.match(body, /await requireAdminService\(\)/);
    assert.match(body, /ADMIN_AUDIT_ACTIONS\.partnerPasswordResetEmailSent/);
  });
});
