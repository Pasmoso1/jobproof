import type { PartnerRewardStatus } from "@/lib/partners/constants";

export type PartnerDashboardStats = {
  totalReferrals: number;
  activeSubscribers: number;
  pendingRewards: number;
  approvedRewards: number;
  totalPaidCad: number;
  pendingAmountCad: number;
  qualifiedAmountCad: number;
  approvedAmountCad: number;
  referredCount: number;
  qualifiedCount: number;
  pendingRewardCount: number;
  approvedRewardCount: number;
  paidCount: number;
};

export function computePartnerDashboardStats(
  referrals: Array<{
    reward_status: string;
    reward_amount: number | string;
    subscription_started_at?: string | null;
  }>,
  payouts: Array<{ amount: number | string }>
): PartnerDashboardStats {
  let pendingRewards = 0;
  let approvedRewards = 0;
  let pendingAmountCad = 0;
  let qualifiedAmountCad = 0;
  let approvedAmountCad = 0;
  let activeSubscribers = 0;
  let referredCount = 0;
  let qualifiedCount = 0;
  let pendingRewardCount = 0;
  let approvedRewardCount = 0;
  let paidCount = 0;

  for (const r of referrals) {
    const amount = Number(r.reward_amount) || 0;
    const status = r.reward_status as PartnerRewardStatus;
    if (r.subscription_started_at && !["cancelled", "forfeited"].includes(status)) {
      activeSubscribers += 1;
    }
    if (!["cancelled", "forfeited"].includes(status)) {
      referredCount += 1;
    }
    if (status === "pending") {
      pendingRewards += 1;
      pendingAmountCad += amount;
      pendingRewardCount += 1;
    }
    if (status === "qualified" || status === "needs_review" || status === "approved") {
      pendingRewards += 1;
      qualifiedAmountCad += amount;
      qualifiedCount += 1;
      if (status === "approved") {
        approvedRewards += 1;
        approvedAmountCad += amount;
        approvedRewardCount += 1;
      }
    }
    if (status === "paid") {
      paidCount += 1;
    }
  }

  const totalPaidCad = payouts.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return {
    totalReferrals: referrals.length,
    activeSubscribers,
    pendingRewards,
    approvedRewards,
    totalPaidCad,
    pendingAmountCad,
    qualifiedAmountCad,
    approvedAmountCad,
    referredCount,
    qualifiedCount,
    pendingRewardCount,
    approvedRewardCount,
    paidCount,
  };
}
