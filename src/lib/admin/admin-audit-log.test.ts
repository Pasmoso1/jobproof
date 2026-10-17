import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  ADMIN_AUDIT_ACTIONS,
  buildAuditIdempotencyKey,
  recordAdminAudit,
  sanitizeAuditMetadata,
} from "@/lib/admin-audit-log";
import {
  FOUNDING_REWARD_CAD,
  PARTNER_QUALIFICATION_DAYS,
  STANDARD_REWARD_CAD,
} from "@/lib/partners/constants";
import { JOBPROOF_TRIAL_DAYS } from "@/lib/trial-lifecycle";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

type InsertResult = { error: { code?: string; message?: string } | null };
function fakeAudit(result: InsertResult | Error) {
  const inserted: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      assert.equal(table, "admin_audit_logs");
      return {
        insert: async (row: Record<string, unknown>) => {
          inserted.push(row);
          if (result instanceof Error) throw result;
          return result;
        },
      };
    },
  };
  return { client: client as unknown as Parameters<typeof recordAdminAudit>[0], inserted };
}

describe("audit metadata sanitization", () => {
  it("keeps small primitive values", () => {
    assert.deepEqual(
      sanitizeAuditMetadata({ from_status: "pending", to_status: "approved", amount_cad: 150, replayed: false, partner_id: "abc", none: null }),
      { from_status: "pending", to_status: "approved", amount_cad: 150, replayed: false, partner_id: "abc", none: null }
    );
  });

  it("drops secrets, links, contact details and free text", () => {
    const out = sanitizeAuditMetadata({
      password: "hunter2",
      access_token: "abc",
      recovery_link: "https://x",
      redirectUrl: "https://x",
      partner_email: "a@b.com",
      phone: "555",
      mailing_address: "1 Main",
      payment_reference: "x",
      decline_reason: "private note",
      notes: "private",
      api_key: "k",
      safe: "ok",
    });
    assert.deepEqual(out, { payment_reference: "x", safe: "ok" });
  });

  it("drops URLs and token-like string values, objects and non-finite numbers", () => {
    const out = sanitizeAuditMetadata({
      a: "https://evil.example/reset?x=1",
      b: "A".repeat(60),
      c: { nested: true },
      d: [1, 2],
      e: Number.NaN,
      f: Number.POSITIVE_INFINITY,
      g: "  ",
      h: "kept",
    });
    assert.deepEqual(out, { h: "kept" });
  });

  it("caps string length and key count", () => {
    const long = sanitizeAuditMetadata({ s: "x ".repeat(300) });
    assert.ok(String(long.s).length <= 200);
    const many = sanitizeAuditMetadata(Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, i])));
    assert.equal(Object.keys(many).length, 20);
    assert.deepEqual(sanitizeAuditMetadata(null), {});
    assert.deepEqual(sanitizeAuditMetadata(undefined), {});
  });
});

describe("recordAdminAudit", () => {
  const base = {
    adminEmail: " Admin@Example.com ",
    action: ADMIN_AUDIT_ACTIONS.partnerSuspended,
    targetType: "partner" as const,
    targetId: "partner-1",
  };

  it("inserts a normalized, sanitized row", async () => {
    const { client, inserted } = fakeAudit({ error: null });
    const res = await recordAdminAudit(client, { ...base, metadata: { to_status: "suspended", partner_email: "x@y.com" }, idempotencyKey: "k1" });
    assert.deepEqual(res, { ok: true, duplicate: false });
    assert.equal(inserted.length, 1);
    assert.deepEqual(inserted[0], {
      admin_email: "admin@example.com",
      action: "partner_suspended",
      target_type: "partner",
      target_id: "partner-1",
      idempotency_key: "k1",
      metadata: { to_status: "suspended" },
    });
  });

  it("treats an idempotency-key collision as a duplicate, not a failure (retry safety)", async () => {
    const { client } = fakeAudit({ error: { code: "23505", message: "duplicate key" } });
    assert.deepEqual(await recordAdminAudit(client, { ...base, idempotencyKey: "k1" }), { ok: true, duplicate: true });
  });

  it("never throws: table missing, other DB errors and exceptions all return ok:false", async () => {
    for (const result of [{ error: { code: "42P01", message: "relation does not exist" } }, { error: { message: "boom" } }, new Error("network")] as const) {
      const { client } = fakeAudit(result as InsertResult | Error);
      assert.deepEqual(await recordAdminAudit(client, base), { ok: false });
    }
  });

  it("refuses to write without an admin identity or a target", async () => {
    const { client, inserted } = fakeAudit({ error: null });
    assert.deepEqual(await recordAdminAudit(client, { ...base, adminEmail: "  " }), { ok: false });
    assert.deepEqual(await recordAdminAudit(client, { ...base, targetId: "" }), { ok: false });
    assert.equal(inserted.length, 0);
  });

  it("builds stable idempotency keys", () => {
    assert.equal(buildAuditIdempotencyKey(ADMIN_AUDIT_ACTIONS.partnerApplicationApproved, "app-1"), "partner_application_approved:app-1");
    assert.equal(buildAuditIdempotencyKey(ADMIN_AUDIT_ACTIONS.referralForceReleased, "r1", "needs_review"), "referral_force_released:r1:needs_review");
  });
});

describe("admin_audit_logs migration (071)", () => {
  const sql = read("supabase/migrations/071_admin_audit_logs.sql");

  it("is the next migration number and does not collide", () => {
    const numbers = readdirSync(join(root, "supabase/migrations")).filter((f) => f.startsWith("071_"));
    assert.deepEqual(numbers, ["071_admin_audit_logs.sql"]);
  });

  it("records admin identity, action, target, timestamp and structured metadata", () => {
    for (const col of ["admin_email text NOT NULL", "action text NOT NULL", "target_type text NOT NULL", "target_id text NOT NULL", "created_at timestamptz NOT NULL DEFAULT now()", "metadata jsonb NOT NULL"]) {
      assert.ok(sql.includes(col), col);
    }
    assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS admin_audit_logs_idempotency_uidx/);
  });

  it("is invisible and unwritable for browser clients", () => {
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /FORCE ROW LEVEL SECURITY/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.admin_audit_logs FROM anon, authenticated/);
    assert.doesNotMatch(sql, /CREATE POLICY/i);
    assert.doesNotMatch(sql, /GRANT[^;]*TO\s+(anon|authenticated|PUBLIC)/i);
  });

  it("is append-only, even for service-role", () => {
    assert.match(sql, /BEFORE UPDATE OR DELETE ON public\.admin_audit_logs/);
    assert.match(sql, /BEFORE TRUNCATE ON public\.admin_audit_logs/);
    assert.match(sql, /REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public\.admin_audit_logs FROM service_role/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_audit_logs_block_mutation\(\) FROM PUBLIC, anon, authenticated/);
    assert.match(sql, /GRANT SELECT, INSERT ON TABLE public\.admin_audit_logs TO service_role/);
  });

  it("does not touch any existing table", () => {
    const touched = [...sql.matchAll(/(?:ALTER TABLE|INSERT INTO|DELETE FROM)\s+(?:IF EXISTS\s+)?(?:public\.)?(\w+)/gi)].map((m) => m[1]);
    for (const t of touched) assert.equal(t, "admin_audit_logs");
  });
});

describe("audit logging is wired to successful admin mutations", () => {
  const actions = read("src/app/admin/partners/actions.ts");
  const payouts = read("src/app/admin/partners/payout-actions.ts");
  const combined = actions + payouts;

  it("every audit action constant is recorded somewhere", () => {
    for (const key of Object.keys(ADMIN_AUDIT_ACTIONS)) {
      assert.match(combined, new RegExp(`ADMIN_AUDIT_ACTIONS\\.${key}\\b`), key);
    }
  });

  it("covers the required sensitive actions", () => {
    for (const key of [
      "partnerApplicationApproved",
      "partnerApplicationDeclined",
      "partnerSuspended",
      "partnerReactivated",
      "referralRewardAdjusted",
      "referralMarkedPaid",
      "referralForceReleased",
      "referralInvalidated",
      "partnerBatchPayoutRecorded",
    ]) {
      assert.match(combined, new RegExp(`ADMIN_AUDIT_ACTIONS\\.${key}\\b`), key);
    }
  });

  it("the audit write comes after the mutation error check", () => {
    const decline = actions.slice(actions.indexOf("export async function adminDeclinePartnerApplication"));
    assert.ok(decline.indexOf("if (declineError)") < decline.indexOf("ADMIN_AUDIT_ACTIONS.partnerApplicationDeclined"));
    const invalidate = payouts.slice(payouts.indexOf("export async function adminInvalidateReferralReward"));
    assert.ok(invalidate.indexOf("if (error) return") < invalidate.indexOf("ADMIN_AUDIT_ACTIONS.referralInvalidated"));
    const batch = payouts.slice(payouts.indexOf("export async function adminRecordPartnerBatchPayout"));
    assert.ok(batch.indexOf("if (!result?.ok)") < batch.indexOf("ADMIN_AUDIT_ACTIONS.partnerBatchPayoutRecorded"));
    const mark = actions.slice(actions.indexOf("export async function adminMarkReferralPaid"));
    assert.ok(mark.indexOf("if (markPaidError)") < mark.indexOf("ADMIN_AUDIT_ACTIONS.referralMarkedPaid"));
  });

  it("one-shot actions are idempotent; repeatable ones only log real changes", () => {
    for (const key of ["partnerApplicationApproved", "partnerApplicationDeclined", "referralInvalidated", "partnerBatchPayoutRecorded", "referralMarkedPaid"]) {
      assert.match(combined, new RegExp(`buildAuditIdempotencyKey\\(\\s*ADMIN_AUDIT_ACTIONS\\.${key}`), key);
    }
    assert.match(actions, /existing\.status !== nextStatus/);
    assert.match(actions, /Number\(existingReward\.reward_amount\) !== amountCad/);
    assert.match(payouts, /released && released\.length > 0/);
  });

  it("audit helper is server-only and never imported by client code", () => {
    assert.doesNotMatch(read("src/app/admin/partners/admin-partners-client.tsx"), /admin-audit-log/);
    assert.doesNotMatch(read("src/lib/admin-audit-log.ts"), /"use client"/);
  });
});

describe("protected business rules are unchanged", () => {
  it("partner reward amounts, qualification period and trial length", () => {
    assert.equal(FOUNDING_REWARD_CAD, 150);
    assert.equal(STANDARD_REWARD_CAD, 100);
    assert.equal(PARTNER_QUALIFICATION_DAYS, 90);
    assert.equal(JOBPROOF_TRIAL_DAYS, 14);
  });

  it("audit wiring does not alter reward calculation or attribution code", () => {
    const payout = read("src/lib/partners/payout-batch.ts");
    assert.doesNotMatch(payout, /admin-audit-log/);
    for (const rel of ["src/lib/partners/apply-attribution.ts", "src/lib/partners/approve.ts"]) {
      assert.doesNotMatch(read(rel), /admin-audit-log/, rel);
    }
  });
});
