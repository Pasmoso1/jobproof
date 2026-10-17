import Link from "next/link";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireAdminUserOrRedirectLogin } from "@/lib/admin-auth";
import { AdminNotAuthorized } from "@/app/admin/NotAuthorized";
import { countRecordsCreatedInLastDays } from "@/lib/admin-metrics";
import {
  buildActivityFeed,
  formatAdminDateTime,
  groupCounts,
  maxIso,
  resolveActivityOwner,
  sourceTuple,
  toMaybeString,
} from "@/lib/admin/product-usage";
import { NeedsPanel } from "@/components/admin/usage/needs-panel";
import { SourceTable } from "@/components/admin/usage/source-table";

export const dynamic = "force-dynamic";

async function safeSelect(
  supabase: SupabaseClient,
  table: string,
  columns = "*"
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) {
    console.warn(`[admin] ${table} unavailable:`, error.message);
    return [];
  }
  return Array.isArray(data) ? (data as unknown as Record<string, unknown>[]) : [];
}

async function fetchAuthEmailsByUserId(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;
    for (const u of data.users) out.set(u.id, u.email ?? "");
    if (data.users.length < perPage) break;
    page += 1;
  }
  return out;
}

export default async function AdminProductUsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const betaFilterRaw = sp.beta;
  const betaFilter = Array.isArray(betaFilterRaw) ? betaFilterRaw[0] : betaFilterRaw;
  const betaFilterNorm =
    betaFilter === "beta" || betaFilter === "non-beta" ? betaFilter : "all";

  const auth = await requireAdminUserOrRedirectLogin(
    betaFilterNorm === "all" ? "/admin/usage" : `/admin/usage?beta=${betaFilterNorm}`
  );
  if (!auth.ok) {
    return <AdminNotAuthorized userEmail={auth.userEmail ?? ""} />;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return (
      <div className="p-8 text-red-700">
        Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL for admin queries.
      </div>
    );
  }
  const admin = createServiceClient(url, key);

  const [
    waitlistRows,
    profilesRows,
    jobsRows,
    contractsRows,
    estimatesRows,
    invoicesRows,
    paymentsRows,
    authEmailByUserId,
  ] = await Promise.all([
    safeSelect(admin, "waitlist_signups", "*"),
    safeSelect(
      admin,
      "profiles",
      "id,user_id,business_name,created_at,signup_utm_source,signup_utm_medium,signup_utm_campaign,heard_about_source,beta_tester,beta_plan_tier"
    ),
    safeSelect(admin, "jobs", "id,profile_id,created_at"),
    safeSelect(admin, "contracts", "id,profile_id,status,created_at,sent_at,signed_at"),
    safeSelect(admin, "estimates", "id,profile_id,status,created_at,sent_at,accepted_at"),
    safeSelect(admin, "invoices", "id,profile_id,status,created_at,sent_at"),
    safeSelect(admin, "invoice_payments", "id,profile_id,created_at,paid_on"),
    fetchAuthEmailsByUserId(admin),
  ]);

  const waitlist = waitlistRows.map((r) => ({
    id: String(r.id ?? ""),
    created_at: toMaybeString(r.created_at),
    email: toMaybeString(r.email),
    trade: toMaybeString(r.trade),
    city: toMaybeString(r.city),
    province: toMaybeString(r.province),
    team_size: toMaybeString(r.team_size),
    plan_interest: toMaybeString(r.plan_interest),
    source: toMaybeString(r.source),
    status: toMaybeString(r.status),
    heard_about_source: toMaybeString(r.heard_about_source),
    utm_source: toMaybeString(r.utm_source),
    utm_medium: toMaybeString(r.utm_medium),
    utm_campaign: toMaybeString(r.utm_campaign),
    landing_page: toMaybeString(r.landing_page),
  }));
  const profiles = profilesRows.map((r) => ({
    id: String(r.id ?? ""),
    user_id: String(r.user_id ?? ""),
    business_name: toMaybeString(r.business_name),
    created_at: String(r.created_at ?? ""),
    signup_utm_source: toMaybeString(r.signup_utm_source),
    signup_utm_medium: toMaybeString(r.signup_utm_medium),
    signup_utm_campaign: toMaybeString(r.signup_utm_campaign),
    heard_about_source: toMaybeString(r.heard_about_source),
    beta_tester: r.beta_tester === true,
    beta_plan_tier: toMaybeString(r.beta_plan_tier),
  }));

  const filteredProfiles =
    betaFilterNorm === "beta"
      ? profiles.filter((p) => p.beta_tester)
      : betaFilterNorm === "non-beta"
        ? profiles.filter((p) => !p.beta_tester)
        : profiles;

  const profilesForActivity = filteredProfiles;

  const jobsByProfile = new Map<string, number>();
  const contractsSentByProfile = new Map<string, number>();
  const contractsSignedByProfile = new Map<string, number>();
  const estimatesSentByProfile = new Map<string, number>();
  const estimatesAcceptedByProfile = new Map<string, number>();
  const invoicesSentByProfile = new Map<string, number>();
  const paymentsByProfile = new Map<string, number>();
  const latestByProfile = new Map<string, string | null>();

  for (const r of jobsRows) {
    const pid = toMaybeString(r.profile_id);
    if (!pid) continue;
    jobsByProfile.set(pid, (jobsByProfile.get(pid) ?? 0) + 1);
    latestByProfile.set(pid, maxIso(latestByProfile.get(pid) ?? null, toMaybeString(r.created_at)));
  }
  for (const r of contractsRows) {
    const pid = toMaybeString(r.profile_id);
    if (!pid) continue;
    const status = String(r.status ?? "").toLowerCase();
    const sent = Boolean(toMaybeString(r.sent_at)) || ["sent", "pending", "signed"].includes(status);
    const signed = Boolean(toMaybeString(r.signed_at)) || status === "signed";
    if (sent) contractsSentByProfile.set(pid, (contractsSentByProfile.get(pid) ?? 0) + 1);
    if (signed) contractsSignedByProfile.set(pid, (contractsSignedByProfile.get(pid) ?? 0) + 1);
    latestByProfile.set(pid, maxIso(latestByProfile.get(pid) ?? null, toMaybeString(r.sent_at) ?? toMaybeString(r.signed_at) ?? toMaybeString(r.created_at)));
  }
  for (const r of estimatesRows) {
    const pid = toMaybeString(r.profile_id);
    if (!pid) continue;
    const status = String(r.status ?? "").toLowerCase();
    const sent = Boolean(toMaybeString(r.sent_at)) || ["sent", "viewed", "accepted", "declined"].includes(status);
    const accepted = Boolean(toMaybeString(r.accepted_at)) || status === "accepted";
    if (sent) estimatesSentByProfile.set(pid, (estimatesSentByProfile.get(pid) ?? 0) + 1);
    if (accepted) estimatesAcceptedByProfile.set(pid, (estimatesAcceptedByProfile.get(pid) ?? 0) + 1);
    latestByProfile.set(pid, maxIso(latestByProfile.get(pid) ?? null, toMaybeString(r.sent_at) ?? toMaybeString(r.accepted_at) ?? toMaybeString(r.created_at)));
  }
  for (const r of invoicesRows) {
    const pid = toMaybeString(r.profile_id);
    if (!pid) continue;
    const status = String(r.status ?? "").toLowerCase();
    const sent = Boolean(toMaybeString(r.sent_at)) || ["sent", "paid", "overdue", "partially_paid"].includes(status);
    if (sent) invoicesSentByProfile.set(pid, (invoicesSentByProfile.get(pid) ?? 0) + 1);
    latestByProfile.set(pid, maxIso(latestByProfile.get(pid) ?? null, toMaybeString(r.sent_at) ?? toMaybeString(r.created_at)));
  }
  for (const r of paymentsRows) {
    const pid = toMaybeString(r.profile_id);
    if (!pid) continue;
    paymentsByProfile.set(pid, (paymentsByProfile.get(pid) ?? 0) + 1);
    latestByProfile.set(pid, maxIso(latestByProfile.get(pid) ?? null, toMaybeString(r.paid_on) ?? toMaybeString(r.created_at)));
  }

  const activatedUsers = jobsByProfile.size;
  const cards = [
    ["Total waitlist signups", waitlist.length],
    ["Total accounts / users", profiles.length],
    ["New accounts last 7 days", countRecordsCreatedInLastDays(profiles, 7)],
    ["Activated users", activatedUsers],
    ["Jobs created", jobsRows.length],
    ["Contracts sent", [...contractsSentByProfile.values()].reduce((a, b) => a + b, 0)],
    ["Contracts signed", [...contractsSignedByProfile.values()].reduce((a, b) => a + b, 0)],
    ["Estimates sent", [...estimatesSentByProfile.values()].reduce((a, b) => a + b, 0)],
    ["Estimates accepted", [...estimatesAcceptedByProfile.values()].reduce((a, b) => a + b, 0)],
    ["Invoices sent", [...invoicesSentByProfile.values()].reduce((a, b) => a + b, 0)],
    ["Payments recorded", [...paymentsByProfile.values()].reduce((a, b) => a + b, 0)],
  ] as const;

  const userActivity = profilesForActivity.map((p) => ({
    profileId: p.id,
    email: authEmailByUserId.get(p.user_id) || "-",
    business: p.business_name || "-",
    created: p.created_at,
    betaTester: p.beta_tester,
    betaPlan: p.beta_plan_tier || "—",
    source:
      [p.signup_utm_source, p.signup_utm_medium, p.signup_utm_campaign]
        .filter(Boolean)
        .join(" / ") || p.heard_about_source || "(none)",
    jobs: jobsByProfile.get(p.id) ?? 0,
    contractsSent: contractsSentByProfile.get(p.id) ?? 0,
    contractsSigned: contractsSignedByProfile.get(p.id) ?? 0,
    estimatesSent: estimatesSentByProfile.get(p.id) ?? 0,
    estimatesAccepted: estimatesAcceptedByProfile.get(p.id) ?? 0,
    invoicesSent: invoicesSentByProfile.get(p.id) ?? 0,
    payments: paymentsByProfile.get(p.id) ?? 0,
    lastActivity: latestByProfile.get(p.id) ?? null,
  }));

  const funnel = [
    ["Waitlist signups", waitlist.length],
    ["Accounts created", profiles.length],
    ["Created first job", jobsByProfile.size],
    ["Sent contract", contractsSentByProfile.size],
    ["Contract signed", contractsSignedByProfile.size],
    ["Sent invoice", invoicesSentByProfile.size],
    ["Recorded payment", paymentsByProfile.size],
  ] as const;

  // Owners come from the FULL profile set; only the feed itself is scoped to the active
  // beta filter. (Previously owners were looked up in the filtered subset, so every row
  // outside the filter rendered as "unknown user".)
  const emailByProfileId = new Map(
    profiles.map((p) => [p.id, authEmailByUserId.get(p.user_id) || "-"] as const)
  );
  const activityFeed = buildActivityFeed(
    {
      profiles,
      jobs: jobsRows,
      contracts: contractsRows,
      estimates: estimatesRows,
      invoices: invoicesRows,
      payments: paymentsRows,
    },
    {
      allowedProfileIds:
        betaFilterNorm === "all" ? null : new Set(filteredProfiles.map((p) => p.id)),
    }
  );
  const waitlistBySource = groupCounts(waitlist.map((w) => sourceTuple(w)));
  const accountsBySource = groupCounts(
    profiles.map((p) =>
      sourceTuple({
        utm_source: p.signup_utm_source,
        utm_medium: p.signup_utm_medium,
        utm_campaign: p.signup_utm_campaign,
        heard_about_source: p.heard_about_source,
      })
    )
  );
  const activationBySource = (() => {
    const m = new Map<string, { total: number; activated: number }>();
    for (const p of profiles) {
      const key = sourceTuple({
        utm_source: p.signup_utm_source,
        utm_medium: p.signup_utm_medium,
        utm_campaign: p.signup_utm_campaign,
        heard_about_source: p.heard_about_source,
      });
      const cur = m.get(key) ?? { total: 0, activated: 0 };
      cur.total += 1;
      if ((jobsByProfile.get(p.id) ?? 0) > 0) cur.activated += 1;
      m.set(key, cur);
    }
    return [...m.entries()]
      .map(([label, stats]) => ({
        label: `${label} | activated ${stats.activated}/${stats.total} (${stats.total > 0 ? Math.round((stats.activated / stats.total) * 100) : 0}%)`,
        count: stats.total,
      }))
      .sort((a, b) => b.count - a.count);
  })();

  const attention = {
    noJobs: userActivity.filter((u) => u.jobs === 0).slice(0, 12),
    noContractSent: userActivity.filter((u) => u.jobs > 0 && u.contractsSent === 0).slice(0, 12),
    contractNotSigned: userActivity.filter((u) => u.contractsSent > 0 && u.contractsSigned === 0).slice(0, 12),
    invoiceNoPayment: userActivity.filter((u) => u.invoicesSent > 0 && u.payments === 0).slice(0, 12),
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Product usage</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Waitlist + acquisition + product usage. Business metrics and alerts are on the{" "}
            <Link href="/admin" className="font-medium text-[#2436BB] underline underline-offset-2">
              Overview
            </Link>
            .
          </p>
        </div>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">{value.toLocaleString()}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-zinc-900">Funnel</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-700">Step</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Count</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">From previous</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {funnel.map(([label, value], i) => (
                  <tr key={label}>
                    <td className="px-3 py-2 text-zinc-800">{label}</td>
                    <td className="px-3 py-2 text-zinc-700">{value.toLocaleString()}</td>
                    <td className="px-3 py-2 text-zinc-600">
                      {i === 0 || funnel[i - 1][1] <= 0
                        ? "-"
                        : `${Math.round((value / funnel[i - 1][1]) * 100)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <SourceTable title="Waitlist by source" rows={waitlistBySource} />
          <SourceTable title="Accounts by source" rows={accountsBySource} />
        </section>

        <SourceTable title="Activation by source" rows={activationBySource} />

        <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">User / product activity</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Beta tester mode is legacy and no longer used for new signups. Existing beta accounts
                retain free access.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All users"],
                  ["beta", "Beta testers"],
                  ["non-beta", "Non-beta users"],
                ] as const
              ).map(([value, label]) => (
                <Link
                  key={value}
                  href={value === "all" ? "/admin/usage" : `/admin/usage?beta=${value}`}
                  className={`inline-flex min-h-[36px] items-center rounded-lg px-3 py-1.5 text-sm font-medium ${
                    betaFilterNorm === value
                      ? "bg-[#2436BB] text-white"
                      : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1100px] text-left text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-700">Email</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Business</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Beta</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Beta plan</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Created</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Source</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Jobs</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Contracts sent</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Contracts signed</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Estimates sent</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Estimates accepted</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Invoices sent</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Payments</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {userActivity.map((u) => (
                  <tr key={u.profileId} className="hover:bg-zinc-50">
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/users/${u.profileId}`}
                        className="font-medium text-[#2436BB] underline decoration-[#2436BB]/40 underline-offset-2 hover:decoration-[#2436BB]"
                      >
                        {u.email}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-zinc-700">{u.business}</td>
                    <td className="px-3 py-2 text-zinc-700">{u.betaTester ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 text-zinc-600">{u.betaPlan}</td>
                    <td className="px-3 py-2 text-zinc-600">{formatAdminDateTime(u.created)}</td>
                    <td className="px-3 py-2 text-zinc-600">{u.source}</td>
                    <td className="px-3 py-2 text-zinc-700">{u.jobs}</td>
                    <td className="px-3 py-2 text-zinc-700">{u.contractsSent}</td>
                    <td className="px-3 py-2 text-zinc-700">{u.contractsSigned}</td>
                    <td className="px-3 py-2 text-zinc-700">{u.estimatesSent}</td>
                    <td className="px-3 py-2 text-zinc-700">{u.estimatesAccepted}</td>
                    <td className="px-3 py-2 text-zinc-700">{u.invoicesSent}</td>
                    <td className="px-3 py-2 text-zinc-700">{u.payments}</td>
                    <td className="px-3 py-2 text-zinc-600">{formatAdminDateTime(u.lastActivity)}</td>
                  </tr>
                ))}
                {userActivity.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-3 py-6 text-center text-zinc-500">
                      No users yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <NeedsPanel
            title="Signed up but no jobs"
            rows={attention.noJobs.map((u) => ({
              profileId: u.profileId,
              email: u.email,
              business: u.business,
              created: u.created,
              last: u.lastActivity,
            }))}
          />
          <NeedsPanel
            title="Created jobs but no contract sent"
            rows={attention.noContractSent.map((u) => ({
              profileId: u.profileId,
              email: u.email,
              business: u.business,
              created: u.created,
              last: u.lastActivity,
            }))}
          />
          <NeedsPanel
            title="Contract sent but not signed"
            rows={attention.contractNotSigned.map((u) => ({
              profileId: u.profileId,
              email: u.email,
              business: u.business,
              created: u.created,
              last: u.lastActivity,
            }))}
          />
          <NeedsPanel
            title="Invoice sent but no payment recorded"
            rows={attention.invoiceNoPayment.map((u) => ({
              profileId: u.profileId,
              email: u.email,
              business: u.business,
              created: u.created,
              last: u.lastActivity,
            }))}
          />
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-zinc-900">Recent activity</h2>
          <ul className="mt-3 divide-y divide-zinc-100">
            {activityFeed.map((a, i) => {
              const ownerEmail = resolveActivityOwner(a.pid, emailByProfileId);
              return (
                <li key={`${a.label}-${a.at}-${i}`} className="py-3 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">{a.label}</span>
                  <span className="mx-2 text-zinc-400">-</span>
                  <span>{ownerEmail}</span>
                  <span className="mx-2 text-zinc-400">-</span>
                  <span className="text-zinc-500">{formatAdminDateTime(a.at)}</span>
                </li>
              );
            })}
            {activityFeed.length === 0 && (
              <li className="py-4 text-sm text-zinc-500">No recent activity</li>
            )}
          </ul>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <SourceTable title="Waitlist by trade" labelHeader="Trade" rows={groupCounts(waitlist.map((w) => w.trade ?? "(none)"))} />
          <SourceTable title="Waitlist by city" labelHeader="City" rows={groupCounts(waitlist.map((w) => w.city ?? "(none)"))} />
          <SourceTable title="Waitlist by plan interest" labelHeader="Plan" rows={groupCounts(waitlist.map((w) => w.plan_interest ?? "(none)"))} />
        </section>

        <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-zinc-900">Raw waitlist signups</h2>
          <table className="mt-3 min-w-[1250px] divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-700">created_at</th>
                <th className="px-3 py-2 font-medium text-zinc-700">email</th>
                <th className="px-3 py-2 font-medium text-zinc-700">trade</th>
                <th className="px-3 py-2 font-medium text-zinc-700">city</th>
                <th className="px-3 py-2 font-medium text-zinc-700">province</th>
                <th className="px-3 py-2 font-medium text-zinc-700">plan_interest</th>
                <th className="px-3 py-2 font-medium text-zinc-700">source</th>
                <th className="px-3 py-2 font-medium text-zinc-700">heard_about</th>
                <th className="px-3 py-2 font-medium text-zinc-700">utm_source</th>
                <th className="px-3 py-2 font-medium text-zinc-700">utm_medium</th>
                <th className="px-3 py-2 font-medium text-zinc-700">utm_campaign</th>
                <th className="px-3 py-2 font-medium text-zinc-700">landing_page</th>
                <th className="px-3 py-2 font-medium text-zinc-700">status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {waitlist.map((w) => (
                <tr key={w.id || `${w.email}-${w.created_at}`}>
                  <td className="px-3 py-2 text-zinc-600">{formatAdminDateTime(w.created_at)}</td>
                  <td className="px-3 py-2 text-zinc-900">{w.email ?? "-"}</td>
                  <td className="px-3 py-2 text-zinc-600">{w.trade ?? "-"}</td>
                  <td className="px-3 py-2 text-zinc-600">{w.city ?? "-"}</td>
                  <td className="px-3 py-2 text-zinc-600">{w.province ?? "-"}</td>
                  <td className="px-3 py-2 text-zinc-600">{w.plan_interest ?? "-"}</td>
                  <td className="px-3 py-2 text-zinc-600">{w.source ?? "-"}</td>
                  <td className="px-3 py-2 text-zinc-600">{w.heard_about_source ?? "-"}</td>
                  <td className="px-3 py-2 text-zinc-600">{w.utm_source ?? "-"}</td>
                  <td className="px-3 py-2 text-zinc-600">{w.utm_medium ?? "-"}</td>
                  <td className="px-3 py-2 text-zinc-600">{w.utm_campaign ?? "-"}</td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-zinc-600">{w.landing_page ?? "-"}</td>
                  <td className="px-3 py-2 text-zinc-600">{w.status ?? "-"}</td>
                </tr>
              ))}
              {waitlist.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-zinc-500">
                    No signups yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
