import Link from "next/link";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireAdminUserOrRedirectLogin } from "@/lib/admin-auth";
import { AdminNotAuthorized } from "@/app/admin/NotAuthorized";
import { PRODUCT_ANALYTICS_EVENTS } from "@/lib/product-analytics";
import { formatBillingDateTimeEastern } from "@/lib/billing-date-display";

function pct(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

async function countEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  eventName: string
): Promise<number> {
  const { count, error } = await supabase
    .from("product_analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", eventName);
  if (error) {
    console.warn(`[admin/analytics] count ${eventName}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

export default async function AdminAnalyticsPage() {
  const auth = await requireAdminUserOrRedirectLogin();
  if (!auth.ok) {
    return <AdminNotAuthorized userEmail={auth.userEmail ?? ""} />;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return (
      <div className="min-h-screen bg-zinc-50 p-8">
        <p className="text-red-700">SUPABASE_SERVICE_ROLE_KEY is required for admin analytics.</p>
      </div>
    );
  }

  const supabase = createServiceClient(url, key);

  const [
    { count: signupCount },
    onboardingStarted,
    firstJobsCreated,
    onboardingCompleted,
    subscriptionStarted,
    stripeConnectCompleted,
    recentEvents,
    profilesWithFirstJob,
    profilesOnboardingCompleted,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    countEvents(supabase, PRODUCT_ANALYTICS_EVENTS.onboarding_started),
    countEvents(supabase, PRODUCT_ANALYTICS_EVENTS.first_job_created),
    countEvents(supabase, PRODUCT_ANALYTICS_EVENTS.onboarding_completed),
    countEvents(supabase, PRODUCT_ANALYTICS_EVENTS.subscription_started),
    countEvents(supabase, PRODUCT_ANALYTICS_EVENTS.stripe_connect_completed),
    supabase
      .from("product_analytics_events")
      .select("created_at, event_name, profile_id, metadata, source")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("first_job_created_at", "is", null),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("onboarding_completed_at", "is", null),
  ]);

  const totalSignups = signupCount ?? 0;
  const activatedProfiles = profilesWithFirstJob.count ?? 0;
  const completedProfiles = profilesOnboardingCompleted.count ?? 0;
  const events = recentEvents.data ?? [];

  const cards = [
    ["Total signups", totalSignups],
    ["Onboarding started", onboardingStarted],
    ["First jobs created", firstJobsCreated],
    ["Onboarding completed (events)", onboardingCompleted],
    ["Onboarding completed (profiles)", completedProfiles],
    ["Subscriptions started", subscriptionStarted],
    ["Stripe Connect completed", stripeConnectCompleted],
    ["Activation rate", pct(activatedProfiles, totalSignups)],
    ["Onboarding completion rate", pct(completedProfiles, totalSignups)],
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <Link href="/admin" className="text-sm font-medium text-[#2436BB] hover:underline">
            ← Admin dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900">Product analytics</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Onboarding funnel and activation metrics from internal event tracking.
          </p>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-zinc-900">Recent onboarding events</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[720px] text-left text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-700">Time (Eastern)</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Event</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Profile</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Source</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {events.map((row, i) => (
                  <tr key={`${row.created_at}-${row.event_name}-${i}`}>
                    <td className="px-3 py-2 text-zinc-600">
                      {formatBillingDateTimeEastern(row.created_at) || "—"}
                    </td>
                    <td className="px-3 py-2 font-medium text-zinc-800">{row.event_name}</td>
                    <td className="px-3 py-2 text-zinc-600">
                      {row.profile_id ? (
                        <Link
                          href={`/admin/users/${row.profile_id}`}
                          className="text-[#2436BB] hover:underline"
                        >
                          {String(row.profile_id).slice(0, 8)}…
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">{row.source ?? "—"}</td>
                    <td className="max-w-xs truncate px-3 py-2 font-mono text-xs text-zinc-500">
                      {JSON.stringify(row.metadata ?? {})}
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                      No events yet. Apply migration 036 and use the product to generate data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
