import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PARTNER_QUALIFICATION_DAYS } from "@/lib/partners/constants";
import {
  VERIFICATION_REASONS,
  formatVerificationNotes,
  targetStatusAfterVerification,
  verifyReferralForPayout,
  verificationBlockedOnlyByMissingPaymentEmail,
  isPartnerQualifiedBucketStatus,
} from "@/lib/partners/payout-verification";

const NOW = new Date("2026-08-28T12:00:00.000Z");
const SUB_START = new Date(
  NOW.getTime() - (PARTNER_QUALIFICATION_DAYS + 5) * 24 * 60 * 60 * 1000
).toISOString();

function baseReferral(overrides: Record<string, unknown> = {}) {
  return {
    reward_status: "qualified",
    reward_amount: 150,
    qualification_date: NOW.toISOString(),
    subscription_started_at: SUB_START,
    payout_id: null,
    contractor_profile_id: "contractor-1",
    ...overrides,
  };
}

function basePartner(overrides: Record<string, unknown> = {}) {
  return {
    payment_email: "pay@example.com",
    email: "partner@example.com",
    profile_id: null,
    auth_user_id: null,
    partner_level: "founding",
    partner_type: "creator",
    status: "active",
    ...overrides,
  };
}

function baseContractor(overrides: Record<string, unknown> = {}) {
  return {
    subscription_status: "active",
    user_id: "user-contractor",
    ...overrides,
  };
}

describe("payout verification", () => {
  it("passes clean founding creator referral to ready for payment", () => {
    const result = verifyReferralForPayout(
      baseReferral(),
      basePartner(),
      baseContractor(),
      NOW
    );
    assert.equal(result.ready, true);
    assert.deepEqual(result.reasons, []);
    assert.equal(targetStatusAfterVerification(result), "approved");
  });

  it("routes missing payment email to needs review", () => {
    const result = verifyReferralForPayout(
      baseReferral(),
      basePartner({ payment_email: null }),
      baseContractor(),
      NOW
    );
    assert.equal(result.ready, false);
    assert.ok(result.reasons.includes(VERIFICATION_REASONS.missingPaymentEmail));
    assert.equal(targetStatusAfterVerification(result), "needs_review");
    assert.equal(
      verificationBlockedOnlyByMissingPaymentEmail(result.reasons),
      true
    );
  });

  it("flags reward amount mismatch", () => {
    const result = verifyReferralForPayout(
      baseReferral({ reward_amount: 100 }),
      basePartner({ partner_level: "founding", partner_type: "creator" }),
      baseContractor(),
      NOW
    );
    assert.ok(result.reasons.includes(VERIFICATION_REASONS.rewardAmountMismatch));
  });

  it("flags possible self-referral via profile_id", () => {
    const result = verifyReferralForPayout(
      baseReferral({ contractor_profile_id: "same-profile" }),
      basePartner({ profile_id: "same-profile" }),
      baseContractor(),
      NOW
    );
    assert.ok(result.reasons.includes(VERIFICATION_REASONS.possibleSelfReferral));
  });

  it("flags subscription inconsistency when not active-like", () => {
    const result = verifyReferralForPayout(
      baseReferral(),
      basePartner(),
      baseContractor({ subscription_status: "cancelled" }),
      NOW
    );
    assert.ok(
      result.reasons.includes(VERIFICATION_REASONS.subscriptionInconsistency)
    );
  });

  it("flags qualification not met before 90 days", () => {
    const recentStart = new Date(
      NOW.getTime() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const result = verifyReferralForPayout(
      baseReferral({ subscription_started_at: recentStart }),
      basePartner(),
      baseContractor(),
      NOW
    );
    assert.ok(result.reasons.includes(VERIFICATION_REASONS.qualificationNotMet));
  });

  it("flags already paid and associated with payout", () => {
    const result = verifyReferralForPayout(
      baseReferral({ reward_status: "paid", payout_id: "payout-1" }),
      basePartner(),
      baseContractor(),
      NOW
    );
    assert.ok(result.reasons.includes(VERIFICATION_REASONS.alreadyPaid));
    assert.ok(
      result.reasons.includes(VERIFICATION_REASONS.alreadyAssociatedWithPayout)
    );
  });

  it("formats verification notes", () => {
    const notes = formatVerificationNotes([
      VERIFICATION_REASONS.missingPaymentEmail,
      VERIFICATION_REASONS.possibleSelfReferral,
    ]);
    assert.match(notes, /Missing payment email/);
    assert.match(notes, /Possible self-referral/);
  });

  it("maps internal statuses to partner qualified bucket", () => {
    assert.equal(isPartnerQualifiedBucketStatus("qualified"), true);
    assert.equal(isPartnerQualifiedBucketStatus("approved"), true);
    assert.equal(isPartnerQualifiedBucketStatus("needs_review"), true);
    assert.equal(isPartnerQualifiedBucketStatus("pending"), false);
    assert.equal(isPartnerQualifiedBucketStatus("paid"), false);
  });
});
