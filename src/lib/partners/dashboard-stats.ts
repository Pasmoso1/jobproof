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

  for (const r of referrals) {
    const amount = Number(r.reward_amount) || 0;
    const status = r.reward_status as PartnerRewardStatus;
    if (r.subscription_started_at && !["cancelled", "forfeited"].includes(status)) {
      activeSubscribers += 1;
    }
    if (status === "pending" || status === "qualified") {
      pendingRewards += 1;
      if (status === "pending") pendingAmountCad += amount;
      if (status === "qualified") qualifiedAmountCad += amount;
    }
    if (status === "approved") {
      approvedRewards += 1;
      approvedAmountCad += amount;
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
  };
}
