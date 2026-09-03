/** Automated pre-payment verification for partner referral rewards. */

import { isQualifyingPaidSubscriptionStatus } from "@/lib/partners/attribution";
import {
  PARTNER_QUALIFICATION_DAYS,
  rewardAmountForPartner,
  type PartnerLevel,
} from "@/lib/partners/constants";
import { hasPartnerPaymentEmail } from "@/lib/partners/payment-details";

export const VERIFICATION_REASONS = {
  missingPaymentEmail: "Missing payment email",
  possibleSelfReferral: "Possible self-referral",
  subscriptionInconsistency: "Subscription/payment inconsistency",
  rewardAmountMismatch: "Reward amount mismatch",
  alreadyAssociatedWithPayout: "Already associated with payout",
  alreadyPaid: "Already paid",
  partnerSuspended: "Partner suspended",
  qualificationNotMet: "Qualification not met",
  partnerInactive: "Partner not active",
  other: "Other verification issue",
} as const;

export type VerificationReason =
  (typeof VERIFICATION_REASONS)[keyof typeof VERIFICATION_REASONS];

export type VerificationReferralInput = {
  reward_status: string;
  reward_amount: number;
  qualification_date: string | null;
  subscription_started_at: string | null;
  payout_id: string | null;
  contractor_profile_id: string;
};

export type VerificationPartnerInput = {
  payment_email: string | null;
  email: string;
  profile_id: string | null;
  auth_user_id: string | null;
  partner_level: string;
  partner_type: string;
  status: string;
};

export type VerificationContractorInput = {
  subscription_status: string | null;
  user_id: string | null;
};

export type VerificationResult = {
  ready: boolean;
  reasons: VerificationReason[];
};

function daysBetween(startIso: string, end: Date): number {
  const start = new Date(startIso).getTime();
  return Math.floor((end.getTime() - start) / (24 * 60 * 60 * 1000));
}

/**
 * Run conservative automated checks after 90-day qualification.
 * Does not reject referrals aggressively — flags issues for admin review.
 */
export function verifyReferralForPayout(
  referral: VerificationReferralInput,
  partner: VerificationPartnerInput,
  contractor: VerificationContractorInput,
  now: Date = new Date()
): VerificationResult {
  const reasons: VerificationReason[] = [];

  if (referral.reward_status === "paid") {
    reasons.push(VERIFICATION_REASONS.alreadyPaid);
  }
  if (referral.payout_id) {
    reasons.push(VERIFICATION_REASONS.alreadyAssociatedWithPayout);
  }
  if (partner.status === "suspended") {
    reasons.push(VERIFICATION_REASONS.partnerSuspended);
  } else if (partner.status !== "active") {
    reasons.push(VERIFICATION_REASONS.partnerInactive);
  }

  if (!referral.subscription_started_at) {
    reasons.push(VERIFICATION_REASONS.subscriptionInconsistency);
  } else {
    const payingDays = daysBetween(referral.subscription_started_at, now);
    if (payingDays < PARTNER_QUALIFICATION_DAYS) {
      reasons.push(VERIFICATION_REASONS.qualificationNotMet);
    }
  }

  const subStatus = String(contractor.subscription_status ?? "").toLowerCase();
  if (!isQualifyingPaidSubscriptionStatus(subStatus)) {
    reasons.push(VERIFICATION_REASONS.subscriptionInconsistency);
  }

  if (!hasPartnerPaymentEmail(partner.payment_email)) {
    reasons.push(VERIFICATION_REASONS.missingPaymentEmail);
  }

  const level = (
    partner.partner_level === "founding" ? "founding" : "standard"
  ) as PartnerLevel;
  const expectedAmount = rewardAmountForPartner({
    partner_level: level,
    partner_type: partner.partner_type,
  });
  if (Math.abs(Number(referral.reward_amount) - expectedAmount) > 0.001) {
    reasons.push(VERIFICATION_REASONS.rewardAmountMismatch);
  }

  if (
    partner.profile_id &&
    partner.profile_id === referral.contractor_profile_id
  ) {
    reasons.push(VERIFICATION_REASONS.possibleSelfReferral);
  }
  if (
    partner.auth_user_id &&
    contractor.user_id &&
    partner.auth_user_id === contractor.user_id
  ) {
    reasons.push(VERIFICATION_REASONS.possibleSelfReferral);
  }

  const uniqueReasons = [...new Set(reasons)];
  const blockingForReady = uniqueReasons.filter(
    (r) => r !== VERIFICATION_REASONS.missingPaymentEmail
  );

  return {
    ready: blockingForReady.length === 0 && uniqueReasons.length === 0,
    reasons: uniqueReasons,
  };
}

/** True when the only issue is a missing payment email (auto-resolves when partner adds one). */
export function verificationBlockedOnlyByMissingPaymentEmail(
  reasons: VerificationReason[]
): boolean {
  return (
    reasons.length === 1 &&
    reasons[0] === VERIFICATION_REASONS.missingPaymentEmail
  );
}

export function formatVerificationNotes(reasons: VerificationReason[]): string {
  return reasons.join("; ");
}

export function parseVerificationNotes(notes: string | null | undefined): string[] {
  if (!notes?.trim()) return [];
  return notes
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function targetStatusAfterVerification(
  result: VerificationResult
): "approved" | "needs_review" {
  if (result.ready) return "approved";
  return "needs_review";
}

/** Partner-visible bucket: pending, qualified (incl. internal review), or paid. */
export function isPartnerQualifiedBucketStatus(status: string): boolean {
  return ["qualified", "approved", "needs_review"].includes(status);
}
