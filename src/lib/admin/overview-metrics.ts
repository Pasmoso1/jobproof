import {
  hasLinkedPaidSubscription,
  isJobProofManagedTrialActive,
  isJobProofTrialExpired,
} from "@/lib/trial-lifecycle";

/**
 * Pure calculations for the admin Overview. No I/O: everything here takes rows in and
 * returns numbers out, so the rules are unit-tested and the data layer stays thin.
 *
 * Every lifecycle rule delegates to the shared helpers in `trial-lifecycle.ts` — the same
 * ones that gate contractor access, reminders and billing — so the dashboard can never
 * drift from how the product actually classifies an account.
 */

/** Window used by the "Trials ending soon" alert. */
export const TRIALS_ENDING_SOON_DAYS = 3;

export type LifecycleProfileRow = {
  id: string;
  user_id?: string | null;
  business_name?: string | null;
  created_at?: string | null;
  subscription_status?: string | null;
  stripe_subscription_id?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  beta_tester?: boolean | null;
};

export type LifecycleSummary = {
  /** Profiles inspected (after excluding legacy beta testers). */
  inspected: number;
  /** Legacy free-access beta accounts, excluded from trial/subscription metrics. */
  betaExcluded: number;
  activeManagedTrials: number;
  expiredTrials: number;
  /** Stripe subscription linked with status active/trialing/past_due (account status, not revenue). */
  linkedSubscriptions: number;
  linkedActive: number;
  linkedTrialing: number;
  linkedPastDue: number;
  pastDue: LifecycleProfileRow[];
  trialsEndingSoon: LifecycleProfileRow[];
};

function status(row: LifecycleProfileRow): string {
  return String(row.subscription_status ?? "").trim().toLowerCase();
}

/** Classifies profiles with the shared trial/subscription lifecycle helpers. */
export function computeLifecycleSummary(
  rows: readonly LifecycleProfileRow[],
  now: Date = new Date()
): LifecycleSummary {
  const summary: LifecycleSummary = {
    inspected: 0,
    betaExcluded: 0,
    activeManagedTrials: 0,
    expiredTrials: 0,
    linkedSubscriptions: 0,
    linkedActive: 0,
    linkedTrialing: 0,
    linkedPastDue: 0,
    pastDue: [],
    trialsEndingSoon: [],
  };
  const soonMs = now.getTime() + TRIALS_ENDING_SOON_DAYS * 24 * 60 * 60 * 1000;

  for (const row of rows) {
    if (row.beta_tester === true) {
      summary.betaExcluded += 1;
      continue;
    }
    summary.inspected += 1;

    if (hasLinkedPaidSubscription(row)) {
      summary.linkedSubscriptions += 1;
      const st = status(row);
      if (st === "active") summary.linkedActive += 1;
      else if (st === "trialing") summary.linkedTrialing += 1;
      else if (st === "past_due") {
        summary.linkedPastDue += 1;
        summary.pastDue.push(row);
      }
      continue;
    }

    if (isJobProofManagedTrialActive(row, now)) {
      summary.activeManagedTrials += 1;
      const endsMs = new Date(String(row.trial_ends_at)).getTime();
      if (Number.isFinite(endsMs) && endsMs <= soonMs) summary.trialsEndingSoon.push(row);
      continue;
    }

    if (isJobProofTrialExpired(row, now)) summary.expiredTrials += 1;
  }

  summary.trialsEndingSoon.sort(
    (a, b) =>
      new Date(String(a.trial_ends_at)).getTime() - new Date(String(b.trial_ends_at)).getTime()
  );
  return summary;
}

/** A single count that may have failed to load. Never coerce a failure into 0. */
export type MetricCount = { ok: true; value: number } | { ok: false };

export type AttentionSeverity = "urgent" | "warning" | "info";

export type AttentionItem = {
  id: string;
  label: string;
  description: string;
  severity: AttentionSeverity;
  count: MetricCount;
  /** Always an existing admin destination (verified by the navigation integrity test). */
  href: string;
  cta: string;
};

export type AttentionCounts = {
  partnerApplicationsAwaitingReview: MetricCount;
  rewardsReadyForPayout: MetricCount;
  rewardsNeedingReview: MetricCount;
  pastDueContractors: MetricCount;
  trialsEndingSoon: MetricCount;
};

export const PAST_DUE_ANCHOR = "past-due-accounts";
export const TRIALS_ENDING_ANCHOR = "trials-ending-soon";

/**
 * Operational alerts shown under "Needs Your Attention". Only categories with a real,
 * existing admin destination are included.
 *
 * Deliberately omitted (no admin destination exists yet): open support tickets and
 * unresolved partner attribution failures. Add them once their pages ship.
 */
export function buildAttentionItems(counts: AttentionCounts): AttentionItem[] {
  return [
    {
      id: "past-due",
      label: "Past-due subscriptions",
      description: "Contractors whose linked Stripe subscription is past due.",
      severity: "urgent",
      count: counts.pastDueContractors,
      href: `/admin#${PAST_DUE_ANCHOR}`,
      cta: "Review accounts",
    },
    {
      id: "partner-applications",
      label: "Partner applications awaiting review",
      description: "Submitted or under-review applications with no decision yet.",
      severity: "warning",
      count: counts.partnerApplicationsAwaitingReview,
      href: "/admin/partners",
      cta: "Review applications",
    },
    {
      id: "rewards-ready",
      label: "Partner rewards ready for payout",
      description: "Approved rewards not yet included in an Interac e-Transfer payout.",
      severity: "warning",
      count: counts.rewardsReadyForPayout,
      href: "/admin/partners/payouts",
      cta: "Open payouts",
    },
    {
      id: "rewards-review",
      label: "Partner rewards needing review",
      description: "Qualified rewards held back by payout verification.",
      severity: "warning",
      count: counts.rewardsNeedingReview,
      href: "/admin/partners/payouts",
      cta: "Open payouts",
    },
    {
      id: "trials-ending",
      label: `Trials ending within ${TRIALS_ENDING_SOON_DAYS} days`,
      description: "Active managed trials that expire soon. Informational.",
      severity: "info",
      count: counts.trialsEndingSoon,
      href: `/admin#${TRIALS_ENDING_ANCHOR}`,
      cta: "See who",
    },
  ];
}

/** Whether an alert should be styled as active (only real, non-zero counts). */
export function isAttentionActive(item: AttentionItem): boolean {
  return item.count.ok && item.count.value > 0;
}
