import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PAYABLE_REFERRAL_STATUS,
  recordSingleReferralPayout,
  singleReferralPayoutBlocker,
  singleReferralPayoutKey,
} from "./single-referral-payout";

type Row = Record<string, unknown>;
type DbError = { code?: string; message: string } | null;

type Failures = {
  /** Error returned by the payout insert (nothing is inserted). */
  insertPayout?: { code?: string; message: string };
  /** Error returned by the referral link update (nothing is updated). */
  linkUpdate?: { code?: string; message: string };
  /** Error returned by the compensating payout delete (nothing is deleted). */
  deletePayout?: { code?: string; message: string };
  /** Runs right before the link update executes (simulates a concurrent request). */
  beforeLink?: (db: FakeDb) => void;
};

class FakeDb {
  referrals: Row[] = [];
  payouts: Row[] = [];
  failures: Failures = {};
  insertCalls = 0;
  deleteCalls = 0;
  private seq = 0;

  nextId(prefix: string) {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  table(name: string): Row[] {
    if (name === "partner_referrals") return this.referrals;
    if (name === "partner_payouts") return this.payouts;
    throw new Error(`unexpected table ${name}`);
  }

  from(name: string) {
    return new Builder(this, name);
  }
}

class Builder {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row = {};
  private filters: Array<(r: Row) => boolean> = [];
  private limitN: number | null = null;
  private selectAfterWrite = false;

  constructor(
    private db: FakeDb,
    private name: string
  ) {}

  select(...args: string[]) {
    void args;
    if (this.op !== "select") this.selectAfterWrite = true;
    return this;
  }
  insert(payload: Row) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push((r) => (val === null ? r[col] == null : r[col] === val));
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }

  private matching(): Row[] {
    let rows = this.db.table(this.name).filter((r) => this.filters.every((f) => f(r)));
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return rows;
  }

  private execute(): { data: Row[] | null; error: DbError } {
    const f = this.db.failures;
    if (this.op === "select") {
      return { data: this.matching().map((r) => ({ ...r })), error: null };
    }
    if (this.op === "insert") {
      this.db.insertCalls += 1;
      if (f.insertPayout) return { data: null, error: f.insertPayout };
      const key = this.payload.idempotency_key;
      if (
        this.name === "partner_payouts" &&
        key != null &&
        this.db.payouts.some((p) => p.idempotency_key === key)
      ) {
        return { data: null, error: { code: "23505", message: "duplicate key" } };
      }
      const row: Row = { id: this.db.nextId("payout"), ...this.payload };
      this.db.table(this.name).push(row);
      return { data: this.selectAfterWrite ? [{ ...row }] : null, error: null };
    }
    if (this.op === "update") {
      if (this.name === "partner_referrals") f.beforeLink?.(this.db);
      if (f.linkUpdate) return { data: null, error: f.linkUpdate };
      const rows = this.matching();
      for (const r of rows) Object.assign(r, this.payload);
      return { data: this.selectAfterWrite ? rows.map((r) => ({ ...r })) : null, error: null };
    }
    // delete
    this.db.deleteCalls += 1;
    if (f.deletePayout) return { data: null, error: f.deletePayout };
    const doomed = new Set(this.matching());
    const table = this.db.table(this.name);
    const kept = table.filter((r) => !doomed.has(r));
    table.length = 0;
    table.push(...kept);
    return { data: null, error: null };
  }

  maybeSingle() {
    const { data, error } = this.execute();
    return Promise.resolve({ data: data?.[0] ?? null, error });
  }
  single() {
    const { data, error } = this.execute();
    return Promise.resolve({
      data: data?.[0] ?? null,
      error: data?.[0] ? null : (error ?? { message: "no rows" }),
    });
  }
  then<T>(resolve: (v: { data: Row[] | null; error: DbError }) => T) {
    return Promise.resolve(this.execute()).then(resolve);
  }
}

function seed(status = "approved", extra: Row = {}): FakeDb {
  const db = new FakeDb();
  db.referrals.push({
    id: "ref-1",
    partner_id: "partner-1",
    reward_status: status,
    reward_amount: 150,
    payout_id: null,
    contractor_profile_id: "profile-1",
    contractor_business_name: "Acme Roofing",
    partners: { contact_name: "Pat", email: "pat@example.com" },
    ...extra,
  });
  return db;
}

const run = (db: FakeDb, over: Record<string, unknown> = {}) =>
  recordSingleReferralPayout(db as never, {
    referralId: "ref-1",
    createdBy: "admin@jobproof.ca",
    paymentMethod: "e-transfer",
    paymentReference: "REF123",
    paidAt: "2026-10-01T12:00:00.000Z",
    ...over,
  });

describe("recordSingleReferralPayout — happy path", () => {
  it("creates one payout, links the referral, and attributes the admin", async () => {
    const db = seed();
    const result = await run(db);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.resumed, false);
    assert.equal(result.amount, 150);
    assert.equal(result.partnerId, "partner-1");
    assert.equal(result.partner?.email, "pat@example.com");

    assert.equal(db.payouts.length, 1);
    const payout = db.payouts[0];
    assert.equal(payout.idempotency_key, singleReferralPayoutKey("ref-1"));
    assert.equal(payout.idempotency_key, "single_referral:ref-1");
    assert.equal(payout.created_by, "admin@jobproof.ca");
    assert.equal(payout.referral_count, 1);
    assert.equal(payout.amount, 150);
    assert.equal(payout.payment_reference, "REF123");

    const ref = db.referrals[0];
    assert.equal(ref.reward_status, "paid");
    assert.equal(ref.payout_id, payout.id);
    assert.equal(ref.reward_paid_at, "2026-10-01T12:00:00.000Z");
  });

  it("defaults the payment method to e-transfer", async () => {
    const db = seed();
    await run(db, { paymentMethod: undefined });
    assert.equal(db.payouts[0].payment_method, "e-transfer");
  });

  it("does not alter the reward amount", async () => {
    const db = seed("approved", { reward_amount: 100 });
    const result = await run(db);
    assert.equal(result.ok && result.amount, 100);
    assert.equal(db.payouts[0].amount, 100);
  });
});

describe("recordSingleReferralPayout — eligibility (same rule as the grouped payout)", () => {
  it("pays an eligible (approved, unlinked) referral", async () => {
    const db = seed("approved");
    const result = await run(db);
    assert.equal(result.ok, true);
    assert.equal(db.payouts.length, 1);
    assert.equal(PAYABLE_REFERRAL_STATUS, "approved");
  });

  const refused: Array<[string, RegExp]> = [
    ["pending", /90-day qualification/],
    ["qualified", /verified and released/],
    ["needs_review", /verified and released/],
    ["cancelled", /cancelled/],
    ["forfeited", /forfeited/],
    ["paid", /^Already paid$/],
  ];
  for (const [status, message] of refused) {
    it(`refuses a ${status} referral and writes nothing`, async () => {
      const db = seed(status, status === "paid" ? { payout_id: "payout-x" } : {});
      const before = JSON.stringify(db.referrals);
      const result = await run(db);
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.error, message);
      assert.equal(db.insertCalls, 0, "no payout may be created");
      assert.equal(db.payouts.length, 0);
      assert.equal(JSON.stringify(db.referrals), before, "referral must be untouched");
    });
  }

  it("refuses an unknown status", async () => {
    const db = seed("mystery");
    const result = await run(db);
    assert.equal(result.ok, false);
    assert.equal(db.payouts.length, 0);
  });

  it("refuses a paid status even if payout_id is missing (corrupt state)", async () => {
    const db = seed("paid");
    assert.deepEqual(await run(db), { ok: false, error: "Already paid" });
    assert.equal(db.payouts.length, 0);
  });

  it("uses fresh database state: a referral cancelled after being listed is refused", async () => {
    const db = seed("approved");
    db.referrals[0].reward_status = "cancelled"; // changed since the admin screen loaded
    const result = await run(db);
    assert.equal(result.ok, false);
    assert.equal(db.payouts.length, 0);
  });

  it("a status change between the eligibility read and the link rolls the payout back", async () => {
    const db = seed("approved");
    db.failures.beforeLink = (d) => {
      d.referrals[0].reward_status = "cancelled";
    };
    const result = await run(db);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /cancelled/);
    assert.equal(db.payouts.length, 0, "payout must not survive for a now-ineligible referral");
    assert.equal(db.referrals[0].reward_status, "cancelled");
    assert.equal(db.referrals[0].payout_id, null);
  });

  it("the link itself only matches approved, unlinked referrals", async () => {
    const db = seed("approved");
    db.failures.beforeLink = (d) => {
      d.referrals[0].reward_status = "forfeited";
    };
    await run(db);
    assert.equal(db.referrals[0].reward_status, "forfeited", "must never be flipped to paid");
  });

  it("reports an unlinked orphan payout when its referral has become ineligible", async () => {
    const db = seed("cancelled");
    db.payouts.push({
      id: "payout-orphan",
      partner_id: "partner-1",
      amount: 150,
      idempotency_key: "single_referral:ref-1",
    });
    const errors: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };
    let result;
    try {
      result = await run(db);
    } finally {
      console.error = original;
    }
    assert.equal(result.ok, false);
    assert.ok(errors.some((a) => String(a[0]).includes("ORPHAN payout exists for ineligible referral")));
    assert.ok(JSON.stringify(errors).includes("payout-orphan"));
    assert.equal(db.payouts.length, 1, "recorded payments are never deleted silently");
  });

  it("singleReferralPayoutBlocker is a pure rule: only approved + unlinked passes", () => {
    assert.equal(singleReferralPayoutBlocker({ reward_status: "approved", payout_id: null }), null);
    assert.ok(singleReferralPayoutBlocker({ reward_status: "approved", payout_id: "p1" }));
    for (const status of ["pending", "qualified", "needs_review", "cancelled", "forfeited", "paid", ""]) {
      assert.ok(singleReferralPayoutBlocker({ reward_status: status, payout_id: null }), status);
    }
  });
});

describe("recordSingleReferralPayout — retries and duplicates", () => {
  it("a retry after success is rejected as already paid and creates no second payout", async () => {
    const db = seed();
    assert.equal((await run(db)).ok, true);
    const retry = await run(db);
    assert.deepEqual(retry, { ok: false, error: "Already paid" });
    assert.equal(db.payouts.length, 1);
    assert.equal(db.insertCalls, 1);
  });

  it("two concurrent identical attempts pay exactly once", async () => {
    const db = seed();
    const [a, b] = await Promise.all([run(db), run(db)]);
    const oks = [a, b].filter((r) => r.ok);
    const fails = [a, b].filter((r) => !r.ok);
    assert.equal(oks.length, 1, "exactly one attempt may succeed");
    assert.equal(fails.length, 1);
    const fail = fails[0];
    if (!fail.ok) assert.match(fail.error, /Already paid/);
    assert.equal(db.payouts.length, 1, "exactly one payout record");
    assert.equal(db.referrals[0].reward_status, "paid");
    assert.equal(db.referrals[0].payout_id, db.payouts[0].id);
  });

  it("several concurrent attempts still produce one payout", async () => {
    const db = seed();
    const results = await Promise.all([run(db), run(db), run(db), run(db)]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(db.payouts.length, 1);
  });

  it("returns Not found for an unknown referral and writes nothing", async () => {
    const db = new FakeDb();
    const result = await run(db);
    assert.deepEqual(result, { ok: false, error: "Not found" });
    assert.equal(db.payouts.length, 0);
  });

  it("refuses a referral that already points at a payout", async () => {
    const db = seed("approved", { payout_id: "payout-batch" });
    const result = await run(db);
    assert.equal(result.ok, false);
    assert.equal(db.payouts.length, 0);
  });

  it("a concurrent identical request (unique violation) joins the existing payout instead of duplicating", async () => {
    const db = seed();
    // Another request inserted the payout between our lookup and our insert.
    db.failures.insertPayout = undefined;
    const originalFrom = db.from.bind(db);
    let injected = false;
    db.from = (name: string) => {
      if (name === "partner_payouts" && !injected && db.insertCalls === 0) {
        // First payout lookup (resume check) sees nothing; then the racing row appears.
        const b = originalFrom(name);
        const origMaybe = b.maybeSingle.bind(b);
        b.maybeSingle = () => {
          const res = origMaybe();
          injected = true;
          db.payouts.push({
            id: "payout-race",
            partner_id: "partner-1",
            amount: 150,
            idempotency_key: "single_referral:ref-1",
          });
          return res;
        };
        return b;
      }
      return originalFrom(name);
    };

    const result = await run(db);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.payoutId, "payout-race");
    assert.equal(result.resumed, true);
    assert.equal(db.payouts.length, 1);
    assert.equal(db.referrals[0].payout_id, "payout-race");
    assert.equal(db.referrals[0].reward_status, "paid");
  });
});

describe("recordSingleReferralPayout — atomicity / compensation", () => {
  it("removes the payout it created when linking fails (no orphan payout)", async () => {
    const db = seed();
    db.failures.linkUpdate = { message: "connection reset" };
    const result = await run(db);

    assert.equal(result.ok, false);
    assert.equal(db.payouts.length, 0, "payout must be rolled back");
    assert.equal(db.referrals[0].reward_status, "approved");
    assert.equal(db.referrals[0].payout_id, null);
  });

  it("a failed link followed by a retry never produces two payouts", async () => {
    const db = seed();
    db.failures.linkUpdate = { message: "boom" };
    assert.equal((await run(db)).ok, false);
    db.failures.linkUpdate = undefined;
    assert.equal((await run(db)).ok, true);

    assert.equal(db.payouts.length, 1);
    assert.equal(db.referrals[0].reward_status, "paid");
    assert.equal(db.referrals[0].payout_id, db.payouts[0].id);
  });

  it("when compensation also fails, the orphan is reported and the retry re-uses it (no duplicate)", async () => {
    const db = seed();
    db.failures.linkUpdate = { message: "boom" };
    db.failures.deletePayout = { code: "XX000", message: "delete failed" };

    const errors: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };
    try {
      const first = await run(db);
      assert.equal(first.ok, false);
    } finally {
      console.error = original;
    }

    assert.equal(db.payouts.length, 1, "orphan remains because delete failed");
    assert.ok(
      errors.some((a) => String(a[0]).includes("ORPHAN payout could not be removed")),
      "orphan must be logged loudly"
    );
    const logged = JSON.stringify(errors);
    assert.ok(logged.includes(String(db.payouts[0].id)), "log carries payout id for reconciliation");
    assert.ok(logged.includes("ref-1"), "log carries referral id for reconciliation");

    // Retry: the orphan is resumed, the referral is linked, and no second payout exists.
    db.failures = {};
    const orphanId = db.payouts[0].id;
    const retry = await run(db);
    assert.equal(retry.ok, true);
    if (!retry.ok) return;
    assert.equal(retry.resumed, true);
    assert.equal(retry.payoutId, orphanId);
    assert.equal(db.payouts.length, 1);
    assert.equal(db.referrals[0].payout_id, orphanId);
    assert.equal(db.referrals[0].reward_status, "paid");
  });

  it("a link update that changes zero rows is NOT reported as success", async () => {
    const db = seed();
    // Another request paid + linked the referral after our read but before our update.
    db.failures.beforeLink = (d) => {
      d.referrals[0].reward_status = "paid";
      d.referrals[0].payout_id = "payout-other";
    };
    const result = await run(db);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "Already paid");
    // Our own payout is removed because nothing references it.
    assert.equal(db.payouts.length, 0);
    // The other request's link is untouched.
    assert.equal(db.referrals[0].payout_id, "payout-other");
    assert.equal(db.referrals[0].reward_status, "paid");
  });

  it("never deletes a payout that a referral already references", async () => {
    const db = seed();
    // A concurrent identical request links the referral to the payout we created, then our
    // own conditional update matches nothing.
    db.failures.beforeLink = (d) => {
      const mine = d.payouts[0];
      d.referrals[0].reward_status = "paid";
      d.referrals[0].payout_id = mine.id;
    };
    const result = await run(db);
    assert.equal(result.ok, false);
    assert.equal(db.payouts.length, 1, "payout referenced by a referral must be preserved");
    assert.equal(db.deleteCalls, 0);
  });

  it("does not link or delete anything when the payout insert fails", async () => {
    const db = seed();
    db.failures.insertPayout = { message: "insert denied" };
    const result = await run(db);
    assert.deepEqual(result, { ok: false, error: "insert denied" });
    assert.equal(db.payouts.length, 0);
    assert.equal(db.referrals[0].reward_status, "approved");
    assert.equal(db.deleteCalls, 0);
  });
});

describe("recordSingleReferralPayout — resumed payout validation", () => {
  it("refuses to resume a payout with a different amount", async () => {
    const db = seed();
    db.payouts.push({
      id: "payout-old",
      partner_id: "partner-1",
      amount: 100,
      idempotency_key: "single_referral:ref-1",
    });
    const result = await run(db);
    assert.equal(result.ok, false);
    assert.equal(db.referrals[0].reward_status, "approved");
    assert.equal(db.payouts.length, 1);
    assert.equal(db.insertCalls, 0);
  });

  it("refuses to resume a payout belonging to a different partner", async () => {
    const db = seed();
    db.payouts.push({
      id: "payout-old",
      partner_id: "partner-2",
      amount: 150,
      idempotency_key: "single_referral:ref-1",
    });
    const result = await run(db);
    assert.equal(result.ok, false);
    assert.equal(db.referrals[0].payout_id, null);
  });
});
