import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildAttentionItems,
  computeLifecycleSummary,
  isAttentionActive,
  TRIALS_ENDING_SOON_DAYS,
  type AttentionCounts,
  type LifecycleProfileRow,
} from "@/lib/admin/overview-metrics";
import {
  fetchAttentionCounts,
  fetchBusinessPerformance,
  fetchLifecycleProfiles,
  LIFECYCLE_MAX_PAGES,
  LIFECYCLE_PAGE_SIZE,
  toMetricCount,
} from "@/lib/admin/overview-data";
import { JOBPROOF_TRIAL_DAYS } from "@/lib/trial-lifecycle";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const NOW = new Date("2026-10-16T12:00:00.000Z");
const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * day).toISOString();

function row(over: Partial<LifecycleProfileRow>): LifecycleProfileRow {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    subscription_status: "trial",
    stripe_subscription_id: null,
    trial_started_at: iso(-5),
    trial_ends_at: iso(9),
    beta_tester: false,
    ...over,
  };
}

describe("lifecycle summary (uses the shared trial/subscription helpers)", () => {
  it("returns zeros for no data", () => {
    const s = computeLifecycleSummary([], NOW);
    assert.equal(s.inspected, 0);
    assert.equal(s.activeManagedTrials, 0);
    assert.equal(s.linkedSubscriptions, 0);
    assert.equal(s.expiredTrials, 0);
    assert.deepEqual(s.pastDue, []);
    assert.deepEqual(s.trialsEndingSoon, []);
  });

  it("classifies active trials, expired trials, linked subscriptions and past-due accounts", () => {
    const s = computeLifecycleSummary(
      [
        row({ id: "active-trial" }),
        row({ id: "pending", subscription_status: "pending_trial" }),
        row({ id: "expired-status", subscription_status: "expired", trial_ends_at: iso(-2) }),
        row({ id: "expired-by-date", trial_ends_at: iso(-1) }),
        row({ id: "paid", subscription_status: "active", stripe_subscription_id: "sub_1" }),
        row({ id: "stripe-trialing", subscription_status: "trialing", stripe_subscription_id: "sub_2" }),
        row({ id: "late", subscription_status: "past_due", stripe_subscription_id: "sub_3" }),
      ],
      NOW
    );
    assert.equal(s.activeManagedTrials, 2);
    assert.equal(s.expiredTrials, 2);
    assert.equal(s.linkedSubscriptions, 3);
    assert.equal(s.linkedActive, 1);
    assert.equal(s.linkedTrialing, 1);
    assert.equal(s.linkedPastDue, 1);
    assert.deepEqual(s.pastDue.map((r) => r.id), ["late"]);
  });

  it("does not treat trialing or past_due as verified paying: they are broken out separately", () => {
    const s = computeLifecycleSummary(
      [
        row({ subscription_status: "trialing", stripe_subscription_id: "sub_a" }),
        row({ subscription_status: "past_due", stripe_subscription_id: "sub_b" }),
      ],
      NOW
    );
    assert.equal(s.linkedActive, 0);
    assert.equal(s.linkedSubscriptions, 2);
    assert.equal(s.linkedTrialing + s.linkedPastDue, 2);
  });

  it("does not count a subscription status without a linked Stripe subscription", () => {
    const s = computeLifecycleSummary(
      [row({ subscription_status: "active", stripe_subscription_id: null, trial_started_at: null, trial_ends_at: null })],
      NOW
    );
    assert.equal(s.linkedSubscriptions, 0);
    assert.equal(s.activeManagedTrials, 0);
  });

  it("excludes legacy beta testers from trial and subscription metrics", () => {
    const s = computeLifecycleSummary(
      [row({ beta_tester: true }), row({ beta_tester: true, subscription_status: "expired" }), row({})],
      NOW
    );
    assert.equal(s.betaExcluded, 2);
    assert.equal(s.inspected, 1);
    assert.equal(s.activeManagedTrials, 1);
    assert.equal(s.expiredTrials, 0);
  });

  it("flags only active managed trials that end within the window, soonest first", () => {
    const s = computeLifecycleSummary(
      [
        row({ id: "in-2d", trial_ends_at: iso(2) }),
        row({ id: "in-1d", trial_ends_at: iso(1) }),
        row({ id: "in-3d", trial_ends_at: iso(TRIALS_ENDING_SOON_DAYS) }),
        row({ id: "in-5d", trial_ends_at: iso(5) }),
        row({ id: "already-ended", trial_ends_at: iso(-1) }),
        row({ id: "has-sub", trial_ends_at: iso(1), stripe_subscription_id: "sub_x", subscription_status: "active" }),
      ],
      NOW
    );
    assert.deepEqual(s.trialsEndingSoon.map((r) => r.id), ["in-1d", "in-2d", "in-3d"]);
    assert.equal(s.activeManagedTrials, 4);
  });

  it("uses the shared 14-day trial constant, not a hard-coded duration", () => {
    assert.equal(JOBPROOF_TRIAL_DAYS, 14);
    for (const rel of [
      "src/lib/admin/overview-metrics.ts",
      "src/components/admin/overview/business-performance-section.tsx",
    ]) {
      assert.doesNotMatch(read(rel), /\b14[- ]day/i, rel);
    }
    assert.match(
      read("src/components/admin/overview/business-performance-section.tsx"),
      /JOBPROOF_TRIAL_DAYS/
    );
  });
});

describe("operational alert items", () => {
  const ok = (n: number) => ({ ok: true as const, value: n });
  const counts: AttentionCounts = {
    partnerApplicationsAwaitingReview: ok(3),
    rewardsReadyForPayout: ok(2),
    rewardsNeedingReview: ok(0),
    pastDueContractors: ok(1),
    trialsEndingSoon: ok(4),
  };

  it("reports the exact counts it was given", () => {
    const items = buildAttentionItems(counts);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    assert.deepEqual(byId["partner-applications"].count, ok(3));
    assert.deepEqual(byId["rewards-ready"].count, ok(2));
    assert.deepEqual(byId["rewards-review"].count, ok(0));
    assert.deepEqual(byId["past-due"].count, ok(1));
    assert.deepEqual(byId["trials-ending"].count, ok(4));
  });

  it("uses consistent severities: past due urgent, decisions warning, trials informational", () => {
    const sev = Object.fromEntries(buildAttentionItems(counts).map((i) => [i.id, i.severity]));
    assert.equal(sev["past-due"], "urgent");
    assert.equal(sev["partner-applications"], "warning");
    assert.equal(sev["rewards-ready"], "warning");
    assert.equal(sev["rewards-review"], "warning");
    assert.equal(sev["trials-ending"], "info");
  });

  it("zero counts are not active (no false warnings); failures are never shown as zero", () => {
    const items = buildAttentionItems({ ...counts, rewardsNeedingReview: ok(0), pastDueContractors: { ok: false } });
    const review = items.find((i) => i.id === "rewards-review")!;
    const pastDue = items.find((i) => i.id === "past-due")!;
    assert.equal(isAttentionActive(review), false);
    assert.equal(isAttentionActive(pastDue), false);
    assert.deepEqual(pastDue.count, { ok: false });
    assert.equal(isAttentionActive(items.find((i) => i.id === "partner-applications")!), true);
  });

  it("omits categories that have no admin destination yet (support tickets, attribution failures)", () => {
    const ids = buildAttentionItems(counts).map((i) => i.id);
    assert.deepEqual(ids.sort(), [
      "partner-applications",
      "past-due",
      "rewards-ready",
      "rewards-review",
      "trials-ending",
    ]);
  });
});

/** Minimal chainable Supabase stand-in that records filters and resolves a canned result. */
type Result = { count?: number | null; data?: unknown; error?: unknown };
function fakeAdmin(handler: (table: string, calls: string[]) => Result | Promise<Result>) {
  const queries: Array<{ table: string; calls: string[] }> = [];
  const client = {
    from(table: string) {
      const calls: string[] = [];
      queries.push({ table, calls });
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "is", "gte", "order", "range"]) {
        chain[m] = (...args: unknown[]) => {
          calls.push(`${m}:${JSON.stringify(args)}`);
          return chain;
        };
      }
      chain.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(handler(table, calls)).then(resolve, reject);
      return chain;
    },
  };
  return { admin: client as unknown as SupabaseClient, queries };
}

describe("dashboard data access", () => {
  it("toMetricCount maps errors, nulls and throws to unavailable instead of 0", async () => {
    assert.deepEqual(await toMetricCount(Promise.resolve({ count: 7, error: null })), { ok: true, value: 7 });
    assert.deepEqual(await toMetricCount(Promise.resolve({ count: 0, error: null })), { ok: true, value: 0 });
    assert.deepEqual(await toMetricCount(Promise.resolve({ count: null, error: null })), { ok: false });
    assert.deepEqual(await toMetricCount(Promise.resolve({ count: 5, error: { message: "x" } })), { ok: false });
    assert.deepEqual(await toMetricCount(Promise.reject(new Error("boom"))), { ok: false });
  });

  it("fetchAttentionCounts queries the intended statuses with head counts", async () => {
    const { admin, queries } = fakeAdmin((table, calls) => ({
      count: table === "partner_applications" ? 3 : calls.some((c) => c.includes("needs_review")) ? 1 : 2,
      error: null,
    }));
    const lifecycle = computeLifecycleSummary(
      [row({ subscription_status: "past_due", stripe_subscription_id: "sub", id: "p1" }), row({ trial_ends_at: iso(1) })],
      NOW
    );
    const counts = await fetchAttentionCounts(admin, { ...lifecycle, truncated: false });
    assert.deepEqual(counts.partnerApplicationsAwaitingReview, { ok: true, value: 3 });
    assert.deepEqual(counts.rewardsReadyForPayout, { ok: true, value: 2 });
    assert.deepEqual(counts.rewardsNeedingReview, { ok: true, value: 1 });
    assert.deepEqual(counts.pastDueContractors, { ok: true, value: 1 });
    assert.deepEqual(counts.trialsEndingSoon, { ok: true, value: 1 });

    const apps = queries.find((q) => q.table === "partner_applications")!;
    assert.ok(apps.calls.some((c) => c.includes("submitted") && c.includes("under_review")));
    assert.ok(apps.calls.some((c) => c.includes('"head":true')));
    const ready = queries.filter((q) => q.table === "partner_referrals").find((q) => q.calls.some((c) => c.includes('"approved"')))!;
    assert.ok(ready.calls.some((c) => c.startsWith("is:") && c.includes("payout_id")));
  });

  it("fetchAttentionCounts marks lifecycle-derived alerts unavailable when profiles failed to load", async () => {
    const { admin } = fakeAdmin(() => ({ count: 0, error: null }));
    const counts = await fetchAttentionCounts(admin, null);
    assert.deepEqual(counts.pastDueContractors, { ok: false });
    assert.deepEqual(counts.trialsEndingSoon, { ok: false });
    assert.deepEqual(counts.partnerApplicationsAwaitingReview, { ok: true, value: 0 });
  });

  it("fetchAttentionCounts degrades per query on failure", async () => {
    const { admin } = fakeAdmin((table) =>
      table === "partner_applications" ? { count: null, error: { message: "down" } } : { count: 4, error: null }
    );
    const counts = await fetchAttentionCounts(admin, null);
    assert.deepEqual(counts.partnerApplicationsAwaitingReview, { ok: false });
    assert.deepEqual(counts.rewardsReadyForPayout, { ok: true, value: 4 });
  });

  it("fetchLifecycleProfiles pages in bounded chunks and flags truncation", async () => {
    let rangeCalls = 0;
    const { admin } = fakeAdmin(() => {
      rangeCalls += 1;
      return { data: Array.from({ length: LIFECYCLE_PAGE_SIZE }, (_, i) => ({ id: `p${rangeCalls}-${i}` })), error: null };
    });
    const res = await fetchLifecycleProfiles(admin);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.truncated, true);
      assert.equal(res.rows.length, LIFECYCLE_PAGE_SIZE * LIFECYCLE_MAX_PAGES);
    }
    assert.equal(rangeCalls, LIFECYCLE_MAX_PAGES);
  });

  it("fetchLifecycleProfiles stops at a short page and fails closed on error", async () => {
    const short = fakeAdmin(() => ({ data: [{ id: "a" }, { id: "b" }], error: null }));
    const ok = await fetchLifecycleProfiles(short.admin);
    assert.deepEqual(ok.ok && { n: ok.rows.length, t: ok.truncated }, { n: 2, t: false });
    const bad = fakeAdmin(() => ({ data: null, error: { message: "nope" } }));
    assert.deepEqual(await fetchLifecycleProfiles(bad.admin), { ok: false });
  });

  it("fetchBusinessPerformance computes figures and survives partial failure", async () => {
    const { admin } = fakeAdmin((table, calls) => {
      if (table === "profiles" && calls.some((c) => c.startsWith("range:"))) {
        return {
          data: [
            { id: "1", subscription_status: "active", stripe_subscription_id: "s1", trial_started_at: iso(-40), trial_ends_at: iso(-26) },
            { id: "2", subscription_status: "trial", trial_started_at: iso(-1), trial_ends_at: iso(13) },
            { id: "3", subscription_status: "expired", trial_started_at: iso(-30), trial_ends_at: iso(-16) },
          ],
          error: null,
        };
      }
      if (table === "partner_referrals") return { count: null, error: { message: "down" } };
      return { count: 3, error: null };
    });
    const perf = await fetchBusinessPerformance(admin, NOW);
    assert.deepEqual(perf.totalContractors, { ok: true, value: 3 });
    assert.deepEqual(perf.newContractors30d, { ok: true, value: 3 });
    assert.deepEqual(perf.partnerAttributedRegistrations, { ok: false });
    assert.equal(perf.lifecycle?.activeManagedTrials, 1);
    assert.equal(perf.lifecycle?.linkedSubscriptions, 1);
    assert.equal(perf.lifecycle?.expiredTrials, 1);
  });

  it("the overview never selects unbounded row sets or computes revenue", () => {
    const data = read("src/lib/admin/overview-data.ts");
    assert.doesNotMatch(data, /\.select\("\*"\)/);
    assert.doesNotMatch(data, /\b(mrr|arr)\b/i);
    assert.match(data, /\.range\(/);
    assert.match(read("src/app/admin/page.tsx"), /Business Performance|BusinessPerformanceSection/);
    assert.match(read("src/components/admin/overview/business-performance-section.tsx"), /Business Performance/);
    assert.match(read("src/components/admin/overview/attention-section.tsx"), /Needs Your Attention/);
  });
});

describe("Stripe readiness trial terminology", () => {
  it("references the shared trial constant and the managed no-card trial", () => {
    const page = read("src/app/admin/stripe-readiness/page.tsx");
    assert.match(page, /JOBPROOF_TRIAL_DAYS/);
    assert.doesNotMatch(page, /7[- ]day/i);
    assert.match(page, /no card required/i);
  });
});
