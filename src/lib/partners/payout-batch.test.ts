import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminRewardStatusLabel,
  partnerFacingRewardStatusLabel,
  rewardAmountForPartner,
} from "@/lib/partners/constants";
import {
  aggregateReadyPayoutsByPartner,
  buildBatchPayoutIdempotencyKey,
  computePartnerLifetimeTotals,
  computePayoutDashboardTotals,
  sumRewardAmounts,
  type ReferralPayoutRow,
} from "@/lib/partners/payout-batch";

function referral(overrides: Partial<ReferralPayoutRow>): ReferralPayoutRow {
  return {
    id: overrides.id ?? "r1",
    partner_id: overrides.partner_id ?? "p1",
    contractor_business_name: overrides.contractor_business_name ?? "Biz",
    signup_date: overrides.signup_date ?? "2026-01-01",
    subscription_started_at: overrides.subscription_started_at ?? "2026-01-01",
    qualification_date: overrides.qualification_date ?? "2026-05-01",
    reward_amount: overrides.reward_amount ?? 150,
    reward_status: overrides.reward_status ?? "approved",
    verification_notes: overrides.verification_notes ?? null,
    payout_id: overrides.payout_id ?? null,
  };
}

describe("reward amounts unchanged", () => {
  it("Creator/Marketing Founding = $150", () => {
    assert.equal(
      rewardAmountForPartner({ partner_level: "founding", partner_type: "creator" }),
      150
    );
    assert.equal(
      rewardAmountForPartner({ partner_level: "founding", partner_type: "marketing" }),
      150
    );
  });

  it("Creator/Marketing Standard = $100", () => {
    assert.equal(
      rewardAmountForPartner({ partner_level: "standard", partner_type: "creator" }),
      100
    );
    assert.equal(
      rewardAmountForPartner({ partner_level: "standard", partner_type: "marketing" }),
      100
    );
  });

  it("Organization = $150 regardless of level", () => {
    assert.equal(
      rewardAmountForPartner({ partner_level: "standard", partner_type: "organization" }),
      150
    );
    assert.equal(
      rewardAmountForPartner({ partner_level: "founding", partner_type: "organization" }),
      150
    );
  });
});

describe("grouped payout aggregation", () => {
  const partners = [
    {
      id: "p1",
      organization_name: "ABC Partner",
      contact_name: "A",
      payment_email: "abc@example.com",
    },
    {
      id: "p2",
      organization_name: "XYZ Media",
      contact_name: "X",
      payment_email: "xyz@example.com",
    },
  ];

  it("groups multiple approved referrals under one partner", () => {
    const rows = [
      referral({ id: "r1", partner_id: "p1", reward_amount: 150 }),
      referral({ id: "r2", partner_id: "p1", reward_amount: 150 }),
      referral({ id: "r3", partner_id: "p1", reward_amount: 150 }),
    ];
    const summaries = aggregateReadyPayoutsByPartner({ referrals: rows, partners });
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0]!.readyCount, 3);
    assert.equal(summaries[0]!.readyAmountCad, 450);
  });

  it("never groups referrals from different partners", () => {
    const rows = [
      referral({ id: "r1", partner_id: "p1", reward_amount: 150 }),
      referral({ id: "r2", partner_id: "p2", reward_amount: 100 }),
    ];
    const summaries = aggregateReadyPayoutsByPartner({ referrals: rows, partners });
    assert.equal(summaries.length, 2);
    const total = summaries.reduce((n, s) => n + s.readyAmountCad, 0);
    assert.equal(total, 250);
  });

  it("excludes non-approved or already-linked referrals", () => {
    const rows = [
      referral({ id: "r1", partner_id: "p1", reward_status: "approved" }),
      referral({ id: "r2", partner_id: "p1", reward_status: "needs_review" }),
      referral({ id: "r3", partner_id: "p1", reward_status: "approved", payout_id: "paid" }),
      referral({ id: "r4", partner_id: "p1", reward_status: "qualified" }),
    ];
    const summaries = aggregateReadyPayoutsByPartner({ referrals: rows, partners });
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0]!.readyCount, 1);
  });

  it("computes dashboard totals from live records", () => {
    const readySummaries = aggregateReadyPayoutsByPartner({
      referrals: [
        referral({ id: "r1", partner_id: "p1", reward_amount: 150 }),
        referral({ id: "r2", partner_id: "p1", reward_amount: 150 }),
        referral({ id: "r3", partner_id: "p2", reward_amount: 100 }),
      ],
      partners,
    });
    const needsReview = [referral({ id: "r9", partner_id: "p2", reward_status: "needs_review" })];
    const totals = computePayoutDashboardTotals({ readySummaries, needsReviewReferrals: needsReview });
    assert.equal(totals.partnersAwaitingPayment, 2);
    assert.equal(totals.rewardsReady, 3);
    assert.equal(totals.totalOwedCad, 400);
    assert.equal(totals.needsReviewCount, 1);
  });

  it("flags missing payment email on partner summary", () => {
    const rows = [referral({ id: "r1", partner_id: "p1" })];
    const summaries = aggregateReadyPayoutsByPartner({
      referrals: rows,
      partners: [{ ...partners[0]!, payment_email: null }],
    });
    assert.equal(summaries[0]!.missingPaymentEmail, true);
  });
});

describe("idempotency key", () => {
  it("is stable for the same referral set", () => {
    const a = buildBatchPayoutIdempotencyKey("p1", ["r2", "r1"]);
    const b = buildBatchPayoutIdempotencyKey("p1", ["r1", "r2"]);
    assert.equal(a, b);
    assert.match(a, /^batch:p1:/);
  });
});

describe("partner lifetime totals", () => {
  it("does not count pending toward paid", () => {
    const totals = computePartnerLifetimeTotals(
      [
        { reward_status: "pending", reward_amount: 150 },
        { reward_status: "approved", reward_amount: 150 },
        { reward_status: "paid", reward_amount: 100 },
      ],
      100
    );
    assert.equal(totals.pendingQualificationCad, 150);
    assert.equal(totals.readyForPaymentCad, 150);
    assert.equal(totals.paidCad, 100);
    assert.equal(totals.lifetimeQualifiedCad, 400);
  });
});

describe("terminology mapping", () => {
  it("admin approved maps to Ready for payment", () => {
    assert.equal(adminRewardStatusLabel("approved"), "Ready for payment");
    assert.equal(adminRewardStatusLabel("needs_review"), "Needs review");
  });

  it("partner sees needs_review as Qualified", () => {
    assert.equal(partnerFacingRewardStatusLabel("needs_review"), "Qualified");
    assert.equal(partnerFacingRewardStatusLabel("approved"), "Qualified");
  });
});

describe("sumRewardAmounts", () => {
  it("totals grouped payout amount", () => {
    assert.equal(
      sumRewardAmounts([{ reward_amount: 150 }, { reward_amount: 150 }, { reward_amount: 100 }]),
      400
    );
  });
});
