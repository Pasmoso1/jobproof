import Link from "next/link";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireAdminUserOrRedirectLogin } from "@/lib/admin-auth";
import { AdminNotAuthorized } from "@/app/admin/NotAuthorized";
import { buildStripeReadinessReport } from "@/lib/stripe-readiness";

export const dynamic = "force-dynamic";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {label}
    </span>
  );
}

export default async function AdminStripeReadinessPage() {
  const auth = await requireAdminUserOrRedirectLogin();
  if (!auth.ok) {
    return <AdminNotAuthorized userEmail={auth.userEmail ?? ""} />;
  }

  let betaTesterCount = 0;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) {
    const admin = createServiceClient(url, key);
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("beta_tester", true);
    betaTesterCount = count ?? 0;
  }

  const report = buildStripeReadinessReport({ betaTesterCount });

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <Link href="/admin" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            ← Admin dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900">Stripe live readiness</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Safe diagnostics for production Stripe configuration. No secrets are displayed.
          </p>
        </div>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-zinc-900">Overall status</h2>
            <StatusBadge
              ok={report.paidCheckoutReady && report.issues.length === 0}
              label={report.paidCheckoutReady && report.issues.length === 0 ? "Ready" : "Needs attention"}
            />
            <StatusBadge
              ok={report.inferredStripeMode === "live"}
              label={`Stripe mode: ${report.inferredStripeMode}`}
            />
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">NODE_ENV</dt>
              <dd className="font-medium text-zinc-900">{report.nodeEnv}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Secret key prefix</dt>
              <dd className="font-mono text-zinc-900">{report.secretKeyPrefix}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Publishable key prefix</dt>
              <dd className="font-mono text-zinc-900">{report.publishableKeyPrefix}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Key mode consistent</dt>
              <dd className="font-medium text-zinc-900">{report.keyModeConsistent ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Webhook secret</dt>
              <dd className="font-medium text-zinc-900">
                {report.webhookSecretPresent ? "Configured" : "Missing"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Beta tester mode</dt>
              <dd className="font-medium text-zinc-900">
                Legacy ({betaTesterCount} account{betaTesterCount === 1 ? "" : "s"})
              </dd>
              <p className="mt-1 text-xs text-zinc-600">
                No longer used for new signups. Existing beta accounts keep free access until converted.
              </p>
            </div>
          </dl>
        </section>

        {report.issues.length > 0 ? (
          <section className="rounded-xl border border-red-200 bg-red-50 p-5">
            <h2 className="text-base font-semibold text-red-900">Issues</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-red-800">
              {report.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {report.warnings.length > 0 ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-base font-semibold text-amber-950">Warnings</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-900">
              {report.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">Environment variables</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-700">Variable</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Status</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Display</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {report.envVars.map((row) => (
                  <tr key={row.name}>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-800">{row.name}</td>
                    <td className="px-3 py-2">
                      <StatusBadge ok={row.present} label={row.present ? "Present" : "Missing"} />
                    </td>
                    <td className="px-3 py-2 text-zinc-700">{row.display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">Price IDs</h2>
          <p className="mt-1 text-sm text-zinc-600">Only the last few characters are shown.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-700">Variable</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Status</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Suffix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {report.priceIds.map((row) => (
                  <tr key={row.envName}>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-800">{row.envName}</td>
                    <td className="px-3 py-2">
                      <StatusBadge ok={row.present} label={row.present ? "Present" : "Missing"} />
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-700">{row.suffix ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">App &amp; Connect URLs</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-zinc-500">NEXT_PUBLIC_APP_URL</dt>
              <dd className="font-mono text-xs text-zinc-800">
                {report.appUrl}{" "}
                <span className="text-zinc-500">({report.appUrlSource === "env" ? "from env" : "fallback"})</span>
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Connect return URL</dt>
              <dd className="break-all font-mono text-xs text-zinc-800">{report.connectReturnUrl}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Connect refresh URL</dt>
              <dd className="break-all font-mono text-xs text-zinc-800">{report.connectRefreshUrl}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Note</dt>
              <dd className="text-zinc-700">{report.connectUrlSource}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">Webhooks</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-zinc-500">Endpoint</dt>
              <dd className="break-all font-mono text-xs text-zinc-800">{report.webhookEndpoint}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Mode note</dt>
              <dd className="text-zinc-700">{report.webhookModeNote}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Events handled in code</dt>
              <dd className="mt-1">
                <ul className="list-inside list-disc space-y-0.5 text-zinc-700">
                  {report.webhookEventsHandled.map((event) => (
                    <li key={event} className="font-mono text-xs">
                      {event}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">Stripe Tax (SaaS) checklist</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Configure in the Stripe Dashboard — see{" "}
            <code className="text-xs">docs/STRIPE_TAX.md</code>.
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-700">
            {report.stripeTaxOperatorChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">New signup vs legacy beta</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-zinc-700">
            <li>
              <strong className="font-medium text-zinc-900">New signups:</strong> plan selection starts Stripe
              Checkout (live keys in production). Payment method required; 7-day trial before billing.
            </li>
            <li>
              <strong className="font-medium text-zinc-900">Legacy beta testers:</strong>{" "}
              <code className="text-xs">beta_tester=true</code> profiles keep free access. Subscription checkout is
              blocked for those accounts.
            </li>
            <li>
              <strong className="font-medium text-zinc-900">Stripe Connect:</strong> uses the same secret key; Connect
              account IDs are separate from subscription customer IDs.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
