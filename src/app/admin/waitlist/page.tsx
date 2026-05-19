import Link from "next/link";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireAdminUserOrRedirectLogin } from "@/lib/admin-auth";
import { AdminNotAuthorized } from "@/app/admin/NotAuthorized";
import {
  buildEmailToProfileId,
  computeWaitlistSummary,
  fetchAuthEmailsByUserIdForAdmin,
  filterWaitlistRows,
  formatWaitlistSignupTimeEastern,
  normalizeAdminEmail,
  parseWaitlistRows,
  sortWaitlistNewestFirst,
  waitlistSignupSourceLabel,
  type WaitlistFilters,
} from "@/lib/admin-waitlist";

function firstString(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (Array.isArray(v)) return String(v[0] ?? "").trim();
  return String(v ?? "").trim();
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export default async function AdminWaitlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireAdminUserOrRedirectLogin();
  if (!auth.ok) {
    return <AdminNotAuthorized userEmail={auth.userEmail ?? ""} />;
  }

  const sp = await searchParams;
  const filters: WaitlistFilters = {
    q: firstString(sp, "q"),
    province: firstString(sp, "province"),
    source: firstString(sp, "source"),
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return (
      <div className="min-h-screen bg-zinc-50 p-8 text-red-700">
        Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL for admin queries.
      </div>
    );
  }

  const admin = createServiceClient(url, key);

  const [{ data: rawWaitlist, error: waitErr }, profileRes, authEmailByUserId] = await Promise.all([
    admin.from("waitlist_signups").select("*").order("created_at", { ascending: false }),
    admin.from("profiles").select("id, user_id, business_contact_email"),
    fetchAuthEmailsByUserIdForAdmin(admin),
  ]);

  if (waitErr) {
    console.warn("[admin/waitlist] waitlist load failed:", waitErr.message);
  }

  const rows = sortWaitlistNewestFirst(parseWaitlistRows(Array.isArray(rawWaitlist) ? rawWaitlist : []));
  const summary = computeWaitlistSummary(rows);
  const emailToProfile = buildEmailToProfileId({
    profiles: Array.isArray(profileRes.data) ? profileRes.data : [],
    authEmailByUserId,
  });

  const provinces = uniqueSorted(rows.map((r) => String(r.province ?? "").trim()).filter(Boolean));
  const sources = uniqueSorted(rows.map((r) => waitlistSignupSourceLabel(r)));

  const filtered = filterWaitlistRows(rows, filters);

  const exportQuery = new URLSearchParams();
  if (filters.q) exportQuery.set("q", filters.q);
  if (filters.province) exportQuery.set("province", filters.province);
  if (filters.source) exportQuery.set("source", filters.source);
  const exportHref = `/admin/waitlist/export${exportQuery.toString() ? `?${exportQuery}` : ""}`;

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-medium text-[#2436BB] hover:underline">
              ← Admin dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-zinc-900 sm:text-3xl">Early access signups</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Waitlist from the public homepage — read-only. Use filters and export for outreach prep.
            </p>
          </div>
          <a
            href={exportHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Export CSV
          </a>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[
            ["Total signups", summary.total],
            ["Signups today (Eastern)", summary.signupsTodayEastern],
            ["Last 7 days", summary.signupsLast7DaysRolling],
            ["Top province", summary.topProvince],
            ["Top signup source", summary.topSource],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-2 break-words text-lg font-semibold text-zinc-900 sm:text-xl">
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-zinc-900">Filters</h2>
          <form method="get" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm">
              <span className="text-zinc-600">Search email</span>
              <input
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder="name@example.com"
                className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600">Province</span>
              <select
                name="province"
                defaultValue={filters.province}
                className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              >
                <option value="">All provinces</option>
                {provinces.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2 lg:col-span-2">
              <span className="text-zinc-600">Signup source</span>
              <select
                name="source"
                defaultValue={filters.source}
                className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              >
                <option value="">All sources</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1c2a96]"
              >
                Apply filters
              </button>
              <Link
                href="/admin/waitlist"
                className="inline-flex min-h-[44px] items-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Clear
              </Link>
            </div>
          </form>
          <p className="mt-3 text-sm text-zinc-500">
            Showing <span className="font-medium text-zinc-700">{filtered.length}</span> of{" "}
            <span className="font-medium text-zinc-700">{rows.length}</span> signups
          </p>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  <th className="whitespace-nowrap px-3 py-3 font-medium text-zinc-700 sm:px-4">
                    Signed up (Eastern)
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium text-zinc-700 sm:px-4">Email</th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium text-zinc-700 sm:px-4">Status</th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium text-zinc-700 sm:px-4">Province</th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium text-zinc-700 sm:px-4">Source</th>
                  <th className="min-w-[200px] px-3 py-3 font-medium text-zinc-700 sm:px-4">Campaign / UTM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((row) => {
                  const em = normalizeAdminEmail(row.email);
                  const profileId = em ? emailToProfile.get(em) : undefined;
                  return (
                    <tr key={row.id} className="align-top hover:bg-zinc-50/80">
                      <td className="whitespace-nowrap px-3 py-3 text-zinc-600 sm:px-4">
                        {formatWaitlistSignupTimeEastern(row.created_at)}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-zinc-900 sm:px-4 sm:text-sm">{em || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                        {profileId ? (
                          <Link
                            href={`/admin/users/${profileId}`}
                            className="font-medium text-[#2436BB] underline decoration-[#2436BB]/40 underline-offset-2 hover:decoration-[#2436BB]"
                          >
                            Registered user
                          </Link>
                        ) : (
                          <span className="text-zinc-600">Waitlist only</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-zinc-700 sm:px-4">
                        {String(row.province ?? "").trim() || "—"}
                      </td>
                      <td
                        className="max-w-[160px] truncate px-3 py-3 text-zinc-700 sm:px-4"
                        title={waitlistSignupSourceLabel(row)}
                      >
                        {waitlistSignupSourceLabel(row)}
                      </td>
                      <td className="px-3 py-3 text-xs text-zinc-600 sm:px-4 sm:text-sm">
                        <div className="space-y-0.5">
                          {row.utm_medium ? (
                            <div>
                              <span className="text-zinc-500">medium:</span> {row.utm_medium}
                            </div>
                          ) : null}
                          {row.utm_campaign ? (
                            <div>
                              <span className="text-zinc-500">campaign:</span> {row.utm_campaign}
                            </div>
                          ) : null}
                          {row.heard_about_source ? (
                            <div>
                              <span className="text-zinc-500">heard:</span> {row.heard_about_source}
                            </div>
                          ) : null}
                          {row.landing_page ? (
                            <div className="max-w-md truncate" title={row.landing_page}>
                              <span className="text-zinc-500">landing:</span> {row.landing_page}
                            </div>
                          ) : null}
                          {!row.utm_medium &&
                          !row.utm_campaign &&
                          !row.heard_about_source &&
                          !row.landing_page ? (
                            <span className="text-zinc-400">—</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                      No signups match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-center text-xs text-zinc-500 sm:text-left">
          Future: beta invites, campaigns, and ESP export can build on this list — not enabled yet.
        </p>
      </main>
    </div>
  );
}
