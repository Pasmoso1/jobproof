import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUserOrRedirectLogin } from "@/lib/admin-auth";
import { AdminNotAuthorized } from "@/app/admin/NotAuthorized";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { formatBillingDateTimeEastern } from "@/lib/billing-date-display";
import {
  fetchAttentionCounts,
  fetchBusinessPerformance,
  fetchWaitlistOverview,
  resolveFollowUpAccounts,
} from "@/lib/admin/overview-data";
import { buildAttentionItems } from "@/lib/admin/overview-metrics";
import { AccountFollowUp } from "@/components/admin/overview/account-follow-up";
import { AttentionSection } from "@/components/admin/overview/attention-section";
import { BusinessPerformanceSection } from "@/components/admin/overview/business-performance-section";
import { WaitlistSummary } from "@/components/admin/overview/waitlist-summary";

export const dynamic = "force-dynamic";

/** Rows shown per drill-down list (the alert cards show the full count). */
const FOLLOW_UP_LIMIT = 10;

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const betaRaw = Array.isArray(sp.beta) ? sp.beta[0] : sp.beta;
  const legacyBeta = betaRaw === "beta" || betaRaw === "non-beta" ? betaRaw : null;

  const auth = await requireAdminUserOrRedirectLogin(
    legacyBeta ? `/admin?beta=${legacyBeta}` : "/admin"
  );
  if (!auth.ok) {
    return <AdminNotAuthorized userEmail={auth.userEmail ?? ""} />;
  }

  // The beta-tester filter now lives on Product usage; keep old bookmarks working.
  if (legacyBeta) redirect(`/admin/usage?beta=${legacyBeta}`);

  const admin = createServiceRoleClient();
  if (!admin) {
    return (
      <div className="p-8 text-red-700">
        Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL for admin queries.
      </div>
    );
  }

  const now = new Date();
  const [performance, waitlist] = await Promise.all([
    fetchBusinessPerformance(admin, now),
    fetchWaitlistOverview(admin, now),
  ]);
  const attentionCounts = await fetchAttentionCounts(admin, performance.lifecycle);
  const attentionItems = buildAttentionItems(attentionCounts);

  const pastDueRows = performance.lifecycle?.pastDue ?? [];
  const trialsEndingRows = performance.lifecycle?.trialsEndingSoon ?? [];
  const [pastDueAccounts, trialsEndingAccounts] = await Promise.all([
    resolveFollowUpAccounts(admin, pastDueRows.slice(0, FOLLOW_UP_LIMIT), () =>
      "Subscription status: past due"
    ),
    resolveFollowUpAccounts(admin, trialsEndingRows.slice(0, FOLLOW_UP_LIMIT), (row) =>
      `Trial ends ${formatBillingDateTimeEastern(String(row.trial_ends_at ?? "")) || "soon"}`
    ),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Admin Overview</h1>
          <p className="mt-1 text-sm text-zinc-600">
            How JobProof is performing, and what needs your attention. Detailed usage lives in{" "}
            <Link
              href="/admin/usage"
              className="font-medium text-[#2436BB] underline underline-offset-2"
            >
              Product usage
            </Link>
            .
          </p>
        </div>

        <BusinessPerformanceSection data={performance} />

        <AttentionSection items={attentionItems} />

        <AccountFollowUp
          pastDue={pastDueAccounts}
          pastDueTotal={pastDueRows.length}
          trialsEnding={trialsEndingAccounts}
          trialsEndingTotal={trialsEndingRows.length}
        />

        <WaitlistSummary data={waitlist} />
      </main>
    </div>
  );
}
