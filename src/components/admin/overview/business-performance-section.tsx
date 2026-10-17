import { MetricCard } from "@/components/admin/overview/metric-card";
import type { BusinessPerformanceData } from "@/lib/admin/overview-data";
import {
  NEW_CONTRACTOR_WINDOW_DAYS,
} from "@/lib/admin/overview-data";
import type { MetricCount } from "@/lib/admin/overview-metrics";
import { JOBPROOF_TRIAL_DAYS } from "@/lib/trial-lifecycle";

function lifecycleCount(
  lifecycle: BusinessPerformanceData["lifecycle"],
  pick: (l: NonNullable<BusinessPerformanceData["lifecycle"]>) => number
): MetricCount {
  return lifecycle ? { ok: true, value: pick(lifecycle) } : { ok: false };
}

/** SECTION A — "How is JobProof performing?" Only metrics that can be derived reliably today. */
export function BusinessPerformanceSection({ data }: { data: BusinessPerformanceData }) {
  const lc = data.lifecycle;
  const subscriptionHint = lc
    ? `${lc.linkedActive.toLocaleString("en-CA")} active · ${lc.linkedTrialing.toLocaleString(
        "en-CA"
      )} trialing · ${lc.linkedPastDue.toLocaleString(
        "en-CA"
      )} past due. Account status only, not verified revenue.`
    : undefined;

  return (
    <section aria-labelledby="business-performance-heading" className="space-y-3">
      <div>
        <h2 id="business-performance-heading" className="text-lg font-semibold text-zinc-900">
          Business Performance
        </h2>
        <p className="mt-1 text-sm text-zinc-600">How JobProof is performing, from account data.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Total registered contractors"
          count={data.totalContractors}
          hint="All contractor accounts, including legacy beta testers."
        />
        <MetricCard
          label={`New registrations (last ${NEW_CONTRACTOR_WINDOW_DAYS} days)`}
          count={data.newContractors30d}
          hint="Accounts created in the rolling window."
        />
        <MetricCard
          label="Active managed trials"
          count={lifecycleCount(lc, (l) => l.activeManagedTrials)}
          hint={`JobProof-managed ${JOBPROOF_TRIAL_DAYS}-day trial, no card required, not yet expired.`}
        />
        <MetricCard
          label="Linked subscriptions"
          count={lifecycleCount(lc, (l) => l.linkedSubscriptions)}
          hint={subscriptionHint}
        />
        <MetricCard
          label="Expired trials"
          count={lifecycleCount(lc, (l) => l.expiredTrials)}
          hint="Trial ended with no linked subscription."
        />
        <MetricCard
          label="Partner-attributed registrations"
          count={data.partnerAttributedRegistrations}
          hint="Contractors credited to a partner referral (any reward status)."
        />
      </div>

      <p className="text-xs leading-relaxed text-zinc-500">
        Trial and subscription figures exclude{" "}
        {lc ? lc.betaExcluded.toLocaleString("en-CA") : "legacy"} legacy beta tester
        {lc && lc.betaExcluded === 1 ? "" : "s"} (free access). Revenue (MRR/ARR), churn and
        conversion reporting arrive in a later phase.
        {lc?.truncated
          ? " Lifecycle figures are based on the first 10,000 accounts and may be incomplete."
          : ""}
        {!lc ? " Trial and subscription figures could not be loaded." : ""}
      </p>
    </section>
  );
}
