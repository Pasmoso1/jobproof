import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUDIT_WARNING_MESSAGE,
  auditWarning,
  recordAdminAudit,
} from "@/lib/admin-audit-log";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Returns the source of one exported async function (up to the next top-level export). */
function fnBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const next = src.indexOf("\nexport async function ", start + 10);
  return src.slice(start, next === -1 ? undefined : next);
}

function captureErrors<T>(fn: () => Promise<T>) {
  const calls: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };
  return fn()
    .then((result) => ({ result, calls }))
    .finally(() => {
      console.error = original;
    });
}

const input = {
  adminEmail: "Admin@JobProof.ca",
  action: "referral_marked_paid" as const,
  targetType: "partner_referral" as const,
  targetId: "ref-123",
  idempotencyKey: "referral_marked_paid:ref-123",
  metadata: { amount_cad: 150, payment_reference: "SECRET-REF", partner_email: "p@x.com" },
};

describe("audit failure visibility", () => {
  it("auditWarning adds nothing for recorded, duplicate, or absent audits", () => {
    assert.deepEqual(auditWarning({ ok: true, duplicate: false }), {});
    assert.deepEqual(auditWarning({ ok: true, duplicate: true }), {});
    assert.deepEqual(auditWarning(null), {});
    assert.deepEqual(auditWarning(undefined), {});
  });

  it("auditWarning returns a message only for a failed audit", () => {
    assert.deepEqual(auditWarning({ ok: false }), { auditWarning: AUDIT_WARNING_MESSAGE });
    assert.match(AUDIT_WARNING_MESSAGE, /succeeded/i);
    assert.match(AUDIT_WARNING_MESSAGE, /\[admin-audit\] FAILED/);
  });

  it("logs a greppable [admin-audit] FAILED record with reconciliation ids and no metadata", async () => {
    const client = {
      from: () => ({ insert: async () => ({ error: { code: "42P01", message: "relation missing" } }) }),
    };
    const { result, calls } = await captureErrors(() =>
      recordAdminAudit(client as never, input)
    );
    assert.deepEqual(result, { ok: false });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "[admin-audit] FAILED");
    const payload = calls[0][1] as Record<string, unknown>;
    assert.equal(payload.reason, "insert_failed");
    assert.equal(payload.action, "referral_marked_paid");
    assert.equal(payload.targetId, "ref-123");
    assert.equal(payload.adminEmail, "admin@jobproof.ca");
    assert.equal(payload.idempotencyKey, "referral_marked_paid:ref-123");
    assert.equal(payload.code, "42P01");
    const serialized = JSON.stringify(calls);
    assert.ok(!serialized.includes("SECRET-REF"), "metadata must not be logged");
    assert.ok(!serialized.includes("p@x.com"), "contact details must not be logged");
    assert.ok(!serialized.includes("relation missing"), "raw provider message is not logged");
  });

  it("logs and reports failure (never throws) when the insert throws", async () => {
    const client = {
      from: () => ({
        insert: async () => {
          throw new Error("network down");
        },
      }),
    };
    const { result, calls } = await captureErrors(() =>
      recordAdminAudit(client as never, input)
    );
    assert.deepEqual(result, { ok: false });
    assert.equal(calls[0][0], "[admin-audit] FAILED");
    assert.equal((calls[0][1] as Record<string, unknown>).reason, "insert_threw");
  });

  it("logs a failure when identity or target is missing", async () => {
    const client = { from: () => ({ insert: async () => ({ error: null }) }) };
    const { result, calls } = await captureErrors(() =>
      recordAdminAudit(client as never, { ...input, targetId: "  " })
    );
    assert.deepEqual(result, { ok: false });
    assert.equal(calls.length, 1);
    assert.equal((calls[0][1] as Record<string, unknown>).reason, "missing_identity_or_target");
  });

  it("treats a unique violation as an already-recorded duplicate, not a failure", async () => {
    const client = {
      from: () => ({ insert: async () => ({ error: { code: "23505", message: "dup" } }) }),
    };
    const { result, calls } = await captureErrors(() =>
      recordAdminAudit(client as never, input)
    );
    assert.deepEqual(result, { ok: true, duplicate: true });
    assert.equal(calls.length, 0);
  });
});

describe("financial admin actions surface audit failures", () => {
  const actions = code(read("src/app/admin/partners/actions.ts"));
  const payouts = code(read("src/app/admin/partners/payout-actions.ts"));

  const cases: Array<[string, string]> = [
    [actions, "adminAdjustReferralReward"],
    [actions, "adminApproveReferralReward"],
    [actions, "adminMarkReferralPaid"],
    [payouts, "adminRecordPartnerBatchPayout"],
    [payouts, "adminReleaseReferralForPayment"],
    [payouts, "adminForceReleaseReferralForPayment"],
    [payouts, "adminInvalidateReferralReward"],
    [payouts, "adminReverifyReferral"],
  ];

  for (const [src, name] of cases) {
    it(`${name} returns auditWarning when its audit write fails`, () => {
      const body = fnBody(src, name);
      assert.match(body, /recordAdminAudit\(/);
      assert.match(body, /\.\.\.auditWarning\(/);
    });
  }

  it("the admin UIs display auditWarning", () => {
    for (const rel of [
      "src/app/admin/partners/admin-partners-client.tsx",
      "src/app/admin/partners/payouts/payout-dashboard-client.tsx",
      "src/app/admin/partners/payouts/[partnerId]/partner-payout-detail-client.tsx",
    ]) {
      const src = read(rel);
      assert.match(src, /auditWarning/, rel);
      assert.match(src, /role="alert"/, `${rel} should render the warning as an alert`);
    }
  });

  it("the payout detail page stays open when there is an audit warning so it is seen", () => {
    const src = code(
      read("src/app/admin/partners/payouts/[partnerId]/partner-payout-detail-client.tsx")
    );
    const warnIdx = src.indexOf("result.auditWarning");
    const pushIdx = src.indexOf('router.push("/admin/partners/payouts")');
    assert.ok(warnIdx >= 0 && pushIdx > warnIdx, "warning branch must return before the redirect");
  });
});

describe("batch payout replay safety", () => {
  const body = fnBody(code(read("src/app/admin/partners/payout-actions.ts")), "adminRecordPartnerBatchPayout");

  it("keeps calling the atomic RPC and does not insert payouts directly", () => {
    assert.match(body, /rpc\("record_partner_batch_payout"/);
    assert.doesNotMatch(body, /\.insert\(/);
    assert.doesNotMatch(body, /\.update\(/);
  });

  it("reports an existing payout (read-only) when the key was already used and nothing is left", () => {
    const emptyBranch = body.slice(body.indexOf("!readyReferrals?.length"), body.indexOf("const referralIds"));
    assert.match(emptyBranch, /from\("partner_payouts"\)/);
    assert.match(emptyBranch, /eq\("idempotency_key"/);
    assert.match(emptyBranch, /eq\("partner_id"/);
    assert.match(emptyBranch, /idempotent: true/);
    assert.match(emptyBranch, /No rewards ready for payment/);
  });

  it("handles an RPC replay before analytics, audit and email side effects", () => {
    const replayIdx = body.indexOf("if (result.idempotent)");
    assert.ok(replayIdx > 0);
    for (const sideEffect of ["recordAdminAudit(", "trackProductEventSafe(", "sendPartnerReferralLifecycleEmail("]) {
      assert.ok(
        body.indexOf(sideEffect) > replayIdx,
        `${sideEffect} must come after the replay branch`
      );
    }
    const replayBlock = body.slice(replayIdx, body.indexOf("const amount = Number(result.amount"));
    assert.match(replayBlock, /return \{[\s\S]*idempotent: true/);
    assert.doesNotMatch(replayBlock, /sendPartnerReferralLifecycleEmail|trackProductEventSafe/);
  });

  it("does not change reward amounts or eligibility", () => {
    assert.match(body, /\.eq\("reward_status", "approved"\)/);
    assert.match(body, /\.is\("payout_id", null\)/);
  });
});

describe("adminMarkReferralPaid consistency", () => {
  const body = fnBody(code(read("src/app/admin/partners/actions.ts")), "adminMarkReferralPaid");

  it("delegates to the guarded single-payout helper and never writes payouts itself", () => {
    assert.match(body, /recordSingleReferralPayout\(/);
    assert.doesNotMatch(body, /from\("partner_payouts"\)/);
    assert.doesNotMatch(body, /\.insert\(/);
    assert.doesNotMatch(body, /\.update\(/);
  });

  it("only audits, emails and tracks after the payout is confirmed", () => {
    const failIdx = body.indexOf("if (!paid.ok)");
    assert.ok(failIdx > 0);
    for (const next of ["recordAdminAudit(", "trackProductEventSafe(", "sendPartnerReferralLifecycleEmail("]) {
      assert.ok(body.indexOf(next) > failIdx, `${next} must follow the failure return`);
    }
  });

  it("passes the administrator so the payout row is self-attributing", () => {
    assert.match(body, /createdBy: ctx\.email/);
  });
});

describe("single payout helper safety (source)", () => {
  const src = code(read("src/lib/partners/single-referral-payout.ts"));

  it("uses an idempotency key and conditional link, and checks the affected rows", () => {
    assert.match(src, /idempotency_key: idempotencyKey/);
    assert.match(src, /\.is\("payout_id", null\)/);
    assert.match(src, /\.eq\("reward_status", PAYABLE_REFERRAL_STATUS\)/);
    assert.doesNotMatch(src, /\.neq\("reward_status"/);
    assert.match(src, /linked\.length !== 1/);
  });

  it("does not change amounts: pays exactly the stored reward_amount", () => {
    assert.match(src, /Number\(row\.reward_amount\)/);
    assert.doesNotMatch(src, /FOUNDING_REWARD|STANDARD_REWARD|ORGANIZATION_REWARD/);
  });
});

describe("single payout eligibility parity with the grouped payout", () => {
  const helper = code(read("src/lib/partners/single-referral-payout.ts"));
  const batchAction = code(read("src/app/admin/partners/payout-actions.ts"));
  const rpcSql = read("supabase/migrations/067_partner_batch_payouts.sql");

  it("uses the same payable predicate as the batch action and the batch RPC", () => {
    assert.match(helper, /PAYABLE_REFERRAL_STATUS = "approved"/);
    assert.match(batchAction, /\.eq\("reward_status", "approved"\)[\s\S]{0,60}\.is\("payout_id", null\)/);
    assert.match(rpcSql, /reward_status = 'approved'\s+AND payout_id IS NULL\s+FOR UPDATE/);
  });

  it("the pre-check runs before any payout insert, and the link no longer uses a negative status filter", () => {
    assert.ok(helper.indexOf("singleReferralPayoutBlocker(row)") < helper.indexOf(".insert("));
    assert.doesNotMatch(helper, /\.neq\("reward_status"/);
  });

  it("does not touch reward amounts or qualification constants", () => {
    assert.doesNotMatch(helper, /rewardAmountForPartner|PARTNER_QUALIFICATION_DAYS|FOUNDING_REWARD|STANDARD_REWARD/);
  });
});
