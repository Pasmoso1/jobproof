/** Grouped partner payout calculations and aggregation helpers. */

import type { PartnerRewardStatus } from "@/lib/partners/constants";
import { hasPartnerPaymentEmail } from "@/lib/partners/payment-details";

export type ReferralPayoutRow = {
  id: string;
  partner_id: string;
  contractor_business_name: string | null;
  signup_date: string;
  subscription_started_at: string | null;
  qualification_date: string | null;
  reward_amount: number;
  reward_status: PartnerRewardStatus;
  verification_notes: string | null;
  payout_id: string | null;
};

export type PartnerPayoutSummary = {
  partnerId: string;
  organizationName: string;
  contactName: string;
  paymentEmail: string | null;
  readyCount: number;
  readyAmountCad: number;
  needsReviewCount: number;
  missingPaymentEmail: boolean;
  referrals: ReferralPayoutRow[];
};

export type PayoutDashboardTotals = {
  partnersAwaitingPayment: number;
  rewardsReady: number;
  totalOwedCad: number;
  needsReviewCount: number;
  partnersMissingPaymentEmail: number;
};

export function sumRewardAmounts(
  referrals: Array<{ reward_amount: number | string }>
): number {
  return referrals.reduce((sum, r) => sum + (Number(r.reward_amount) || 0), 0);
}

export function aggregateReadyPayoutsByPartner(input: {
  referrals: ReferralPayoutRow[];
  partners: Array<{
    id: string;
    organization_name: string;
    contact_name: string;
    payment_email: string | null;
  }>;
}): PartnerPayoutSummary[] {
  const partnerById = new Map(input.partners.map((p) => [p.id, p]));
  const grouped = new Map<string, ReferralPayoutRow[]>();

  for (const referral of input.referrals) {
    if (referral.reward_status !== "approved" || referral.payout_id) continue;
    const list = grouped.get(referral.partner_id) ?? [];
    list.push(referral);
    grouped.set(referral.partner_id, list);
  }

  const summaries: PartnerPayoutSummary[] = [];
  for (const [partnerId, refs] of grouped) {
    const partner = partnerById.get(partnerId);
    if (!partner) continue;
    const paymentEmail = partner.payment_email ?? null;
    summaries.push({
      partnerId,
      organizationName: partner.organization_name,
      contactName: partner.contact_name,
      paymentEmail,
      readyCount: refs.length,
      readyAmountCad: sumRewardAmounts(refs),
      needsReviewCount: 0,
      missingPaymentEmail: !hasPartnerPaymentEmail(paymentEmail),
      referrals: refs.sort((a, b) =>
        String(a.qualification_date ?? a.signup_date).localeCompare(
          String(b.qualification_date ?? b.signup_date)
        )
      ),
    });
  }

  return summaries.sort((a, b) =>
    a.organizationName.localeCompare(b.organizationName)
  );
}

export function computePayoutDashboardTotals(input: {
  readySummaries: PartnerPayoutSummary[];
  needsReviewReferrals: ReferralPayoutRow[];
}): PayoutDashboardTotals {
  const partnersMissingPaymentEmail = input.readySummaries.filter(
    (s) => s.missingPaymentEmail
  ).length;

  return {
    partnersAwaitingPayment: input.readySummaries.length,
    rewardsReady: input.readySummaries.reduce((n, s) => n + s.readyCount, 0),
    totalOwedCad: input.readySummaries.reduce((n, s) => n + s.readyAmountCad, 0),
    needsReviewCount: input.needsReviewReferrals.length,
    partnersMissingPaymentEmail,
  };
}

export type PartnerLifetimeTotals = {
  lifetimeQualifiedCad: number;
  paidCad: number;
  readyForPaymentCad: number;
  pendingQualificationCad: number;
  qualifiedCount: number;
  pendingCount: number;
  readyCount: number;
  paidReferralCount: number;
};

export function computePartnerLifetimeTotals(
  referrals: Array<{
    reward_status: string;
    reward_amount: number | string;
  }>,
  paidFromPayoutsCad: number
): PartnerLifetimeTotals {
  let lifetimeQualifiedCad = 0;
  let readyForPaymentCad = 0;
  let pendingQualificationCad = 0;
  let qualifiedCount = 0;
  let pendingCount = 0;
  let readyCount = 0;
  let paidReferralCount = 0;

  for (const r of referrals) {
    const amount = Number(r.reward_amount) || 0;
    const status = r.reward_status;
    if (["cancelled", "forfeited"].includes(status)) continue;

    if (status === "pending") {
      pendingQualificationCad += amount;
      pendingCount += 1;
      lifetimeQualifiedCad += amount;
    } else if (["qualified", "approved", "needs_review"].includes(status)) {
      qualifiedCount += 1;
      lifetimeQualifiedCad += amount;
      if (status === "approved") {
        readyForPaymentCad += amount;
        readyCount += 1;
      }
    } else if (status === "paid") {
      paidReferralCount += 1;
      lifetimeQualifiedCad += amount;
    }
  }

  return {
    lifetimeQualifiedCad,
    paidCad: paidFromPayoutsCad,
    readyForPaymentCad,
    pendingQualificationCad,
    qualifiedCount,
    pendingCount,
    readyCount,
    paidReferralCount,
  };
}

export function buildBatchPayoutIdempotencyKey(
  partnerId: string,
  referralIds: string[]
): string {
  const sorted = [...referralIds].sort().join(",");
  return `batch:${partnerId}:${sorted}`;
}
