import type { ReactNode } from "react";
import Link from "next/link";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireAdminUserOrRedirectLogin } from "@/lib/admin-auth";
import { AdminNotAuthorized } from "@/app/admin/NotAuthorized";

function toMaybeString(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(n));
}

/** Street + city/province/postal; omits empty parts. No country column on profiles today. */
function formatBusinessAddress(profile: Record<string, unknown>): string {
  const line1 = toMaybeString(profile.address_line_1);
  const line2 = toMaybeString(profile.address_line_2);
  const city = toMaybeString(profile.city);
  const prov = toMaybeString(profile.province);
  const postal = toMaybeString(profile.postal_code);
  const cityProv = [city, prov].filter(Boolean).join(", ");
  const cityLine = [cityProv, postal].filter(Boolean).join(" ").trim();
  const lines = [line1, line2, cityLine].filter(Boolean);
  if (lines.length === 0) return "—";
  return lines.join("\n");
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function paymentMethodLabel(m: string | null): string {
  const map: Record<string, string> = {
    e_transfer: "E-Transfer",
    cash: "Cash",
    cheque: "Cheque",
    card: "Card",
    other: "Other",
  };
  if (!m) return "—";
  return map[m] ?? m;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

function DefList({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
          <dt className="shrink-0 text-zinc-500">{r.label}</dt>
          <dd className="font-medium text-zinc-800">{r.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function TableShell({ children }: { children: ReactNode }) {
  return <div className="mt-3 overflow-x-auto">{children}</div>;
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const auth = await requireAdminUserOrRedirectLogin();
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

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select(
      `
      id,
      user_id,
      business_name,
      contractor_name,
      business_contact_email,
      phone,
      address_line_1,
      address_line_2,
      city,
      province,
      postal_code,
      created_at,
      signup_utm_source,
      signup_utm_medium,
      signup_utm_campaign,
      signup_utm_content,
      signup_utm_term,
      signup_referrer,
      signup_landing_page,
      signup_first_seen_at,
      heard_about_source,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_price_id,
      plan_tier,
      pricing_version,
      subscription_status,
      subscription_current_period_end,
      trial_ends_at,
      grace_period_ends_at,
      stripe_connect_account_id,
      stripe_connect_onboarding_complete,
      stripe_connect_charges_enabled,
      stripe_connect_payouts_enabled,
      stripe_connect_details_submitted
    `
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-10">
        <div className="mx-auto max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-zinc-900">Account not found</h1>
          <p className="mt-2 text-sm text-zinc-600">
            No profile exists for this ID, or the profile could not be loaded.
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-block text-sm font-medium text-[#2436BB] hover:underline"
          >
            ← Back to admin dashboard
          </Link>
        </div>
      </div>
    );
  }

  const profileId = profile.id as string;
  const userUuid = profile.user_id as string;

  const [jobsRes, estimatesRes, contractsRes, invoicesRes, paymentsRes, authUserRes] =
    await Promise.all([
      admin
        .from("jobs")
        .select(
          "id, title, status, contract_status, invoice_status, current_contract_total, customer_id, created_at"
        )
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false }),
      admin
        .from("estimates")
        .select(
          "id, estimate_number, title, status, subtotal, tax_amount, total, expiry_date, customer_id, sent_at, viewed_at, accepted_at, declined_at, created_at"
        )
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false }),
      admin
        .from("contracts")
        .select(
          "id, job_id, status, price, sent_at, signed_at, created_at, job_title, customer_name"
        )
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false }),
      admin
        .from("invoices")
        .select(
          "id, invoice_number, job_id, status, total, balance_due, sent_at, viewed_at, paid_at, created_at"
        )
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false }),
      admin
        .from("invoice_payments")
        .select("id, invoice_id, amount, paid_on, payment_method, note, created_at")
        .eq("profile_id", profileId)
        .order("paid_on", { ascending: false }),
      admin.auth.admin.getUserById(userUuid),
    ]);

  const jobs = jobsRes.data ?? [];
  const estimates = estimatesRes.data ?? [];
  const contracts = contractsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const payments = paymentsRes.data ?? [];

  const customerIds = new Set<string>();
  for (const j of jobs) {
    if (j.customer_id) customerIds.add(j.customer_id as string);
  }
  for (const e of estimates) {
    if (e.customer_id) customerIds.add(e.customer_id as string);
  }

  let customerMap = new Map<string, string>();
  if (customerIds.size > 0) {
    const { data: customers } = await admin
      .from("customers")
      .select("id, full_name")
      .in("id", [...customerIds]);
    customerMap = new Map((customers ?? []).map((c) => [c.id as string, (c.full_name as string) ?? ""]));
  }

  const jobMap = new Map(jobs.map((j) => [j.id as string, j as Record<string, unknown>]));

  const email =
    authUserRes.data?.user?.email ??
    (authUserRes.error ? "(auth user unavailable or deleted)" : "(no email)");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function estimateDisplayStatus(e: Record<string, unknown>): string {
    const st = String(e.status ?? "").toLowerCase();
    const exp = e.expiry_date ? new Date(String(e.expiry_date)) : null;
    if (exp && exp < today && !["accepted", "declined"].includes(st)) {
      return `${st} (expired)`;
    }
    return st || "—";
  }

  let lastActivity: string | null = toMaybeString(profile.created_at);
  for (const j of jobs) {
    lastActivity = maxIso(lastActivity, toMaybeString(j.created_at));
  }
  for (const e of estimates) {
    lastActivity = maxIso(
      lastActivity,
      toMaybeString(e.sent_at) ?? toMaybeString(e.accepted_at) ?? toMaybeString(e.created_at)
    );
  }
  for (const c of contracts) {
    const st = String(c.status ?? "").toLowerCase();
    const sent = Boolean(toMaybeString(c.sent_at)) || ["sent", "pending", "signed"].includes(st);
    const signed = Boolean(toMaybeString(c.signed_at)) || st === "signed";
    if (sent) lastActivity = maxIso(lastActivity, toMaybeString(c.sent_at));
    if (signed) lastActivity = maxIso(lastActivity, toMaybeString(c.signed_at));
    lastActivity = maxIso(lastActivity, toMaybeString(c.created_at));
  }
  for (const inv of invoices) {
    const st = String(inv.status ?? "").toLowerCase();
    const sent = Boolean(toMaybeString(inv.sent_at)) || ["sent", "paid", "overdue", "partially_paid"].includes(st);
    if (sent) lastActivity = maxIso(lastActivity, toMaybeString(inv.sent_at));
    lastActivity = maxIso(lastActivity, toMaybeString(inv.created_at));
  }
  for (const p of payments) {
    lastActivity = maxIso(lastActivity, toMaybeString(p.paid_on) ?? toMaybeString(p.created_at));
  }

  const jobsCount = jobs.length;
  const estimatesCreated = estimates.length;
  const estimatesSent = estimates.filter(
    (e) =>
      Boolean(toMaybeString(e.sent_at)) ||
      ["sent", "viewed", "accepted", "declined"].includes(String(e.status ?? "").toLowerCase())
  ).length;
  const estimatesAccepted = estimates.filter(
    (e) =>
      Boolean(toMaybeString(e.accepted_at)) || String(e.status ?? "").toLowerCase() === "accepted"
  ).length;

  const contractsCreated = contracts.length;
  const contractsSent = contracts.filter((c) => {
    const st = String(c.status ?? "").toLowerCase();
    return Boolean(toMaybeString(c.sent_at)) || ["sent", "pending", "signed"].includes(st);
  }).length;
  const contractsSigned = contracts.filter((c) => {
    const st = String(c.status ?? "").toLowerCase();
    return Boolean(toMaybeString(c.signed_at)) || st === "signed";
  }).length;

  const invoicesCreated = invoices.length;
  const invoicesSent = invoices.filter((inv) => {
    const st = String(inv.status ?? "").toLowerCase();
    return Boolean(toMaybeString(inv.sent_at)) || ["sent", "paid", "overdue", "partially_paid"].includes(st);
  }).length;
  const invoicesViewed = invoices.filter((inv) => Boolean(toMaybeString(inv.viewed_at))).length;

  const totalInvoiceAmount = invoices
    .filter((inv) => String(inv.status ?? "").toLowerCase() !== "draft")
    .reduce((s, inv) => s + Number(inv.total ?? 0), 0);

  const totalPaymentsRecorded = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const outstandingBalance = invoices
    .filter((inv) => ["sent", "overdue", "partially_paid"].includes(String(inv.status ?? "").toLowerCase()))
    .reduce((s, inv) => s + Number(inv.balance_due ?? 0), 0);

  const sourceLine =
    [profile.signup_utm_source, profile.signup_utm_medium, profile.signup_utm_campaign]
      .filter(Boolean)
      .join(" / ") || (profile.heard_about_source as string) || "—";

  const activity: Array<{ at: string; label: string }> = [
    { at: String(profile.created_at ?? ""), label: "Account created" },
    ...jobs.map((j) => ({
      at: String(j.created_at ?? ""),
      label: `Job created: ${String(j.title ?? "Untitled")}`,
    })),
    ...estimates
      .filter((e) => toMaybeString(e.sent_at))
      .map((e) => ({
        at: String(e.sent_at ?? ""),
        label: `Estimate sent: ${String(e.estimate_number ?? "")} ${String(e.title ?? "")}`.trim(),
      })),
    ...estimates
      .filter(
        (e) =>
          toMaybeString(e.accepted_at) || String(e.status ?? "").toLowerCase() === "accepted"
      )
      .map((e) => ({
        at: String(e.accepted_at ?? e.created_at ?? ""),
        label: `Estimate accepted: ${String(e.estimate_number ?? "")}`,
      })),
    ...contracts
      .filter((c) => {
        const st = String(c.status ?? "").toLowerCase();
        return Boolean(toMaybeString(c.sent_at)) || ["sent", "pending", "signed"].includes(st);
      })
      .map((c) => ({
        at: String(c.sent_at ?? c.created_at ?? ""),
        label: `Contract sent: ${String(c.job_title ?? "Job")}`,
      })),
    ...contracts
      .filter(
        (c) =>
          Boolean(toMaybeString(c.signed_at)) || String(c.status ?? "").toLowerCase() === "signed"
      )
      .map((c) => ({
        at: String(c.signed_at ?? c.created_at ?? ""),
        label: `Contract signed: ${String(c.job_title ?? "Job")}`,
      })),
    ...invoices
      .filter((inv) => {
        const st = String(inv.status ?? "").toLowerCase();
        return Boolean(toMaybeString(inv.sent_at)) || ["sent", "paid", "overdue", "partially_paid"].includes(st);
      })
      .map((inv) => ({
        at: String(inv.sent_at ?? inv.created_at ?? ""),
        label: `Invoice sent: ${String(inv.invoice_number ?? String(inv.id).slice(0, 8))}`,
      })),
    ...invoices
      .filter((inv) => toMaybeString(inv.viewed_at))
      .map((inv) => ({
        at: String(inv.viewed_at ?? ""),
        label: `Invoice viewed: ${String(inv.invoice_number ?? "")}`,
      })),
    ...payments.map((p) => ({
      at: String(p.paid_on ?? p.created_at ?? ""),
      label: `Payment recorded: ${formatMoney(Number(p.amount))}`,
    })),
  ]
    .filter((x) => x.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const flags: string[] = [];
  if (jobsCount === 0) flags.push("Has account but no jobs");
  if (jobsCount > 0 && contractsSent === 0) flags.push("Has jobs but no contract sent");
  if (contractsSent > 0 && contractsSigned === 0) flags.push("Has contract sent but not signed");
  if (invoicesSent > 0 && payments.length === 0) flags.push("Has invoice sent but no payment recorded");
  if (outstandingBalance > 0.005) flags.push("Has outstanding balance");
  if (estimatesSent > 0 && estimatesAccepted === 0) flags.push("Has estimates sent but none accepted");

  const testHint = /@test\.|\+test|test@/i.test(email);

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-medium text-[#2436BB] hover:underline">
              ← Admin dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-zinc-900">Account detail</h1>
            <p className="mt-1 font-mono text-xs text-zinc-500">Profile ID: {profileId}</p>
          </div>
        </div>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-zinc-500">Login email</dt>
                <dd className="font-medium text-zinc-900">{email}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Business name</dt>
                <dd className="font-medium text-zinc-800">{toMaybeString(profile.business_name) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Contact name</dt>
                <dd className="font-medium text-zinc-800">{toMaybeString(profile.contractor_name) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Business contact email</dt>
                <dd className="font-medium text-zinc-800">{toMaybeString(profile.business_contact_email) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Phone</dt>
                <dd className="font-medium text-zinc-800">{toMaybeString(profile.phone) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Address</dt>
                <dd className="whitespace-pre-line font-medium text-zinc-800">
                  {formatBusinessAddress(profile)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Account created</dt>
                <dd className="text-zinc-800">{formatDate(toMaybeString(profile.created_at))}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Last activity</dt>
                <dd className="text-zinc-800">{formatDate(lastActivity)}</dd>
              </div>
            </dl>
            {testHint && (
              <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
                Email pattern suggests a possible test account.
              </p>
            )}
          </div>
        </section>

        <Section title="Attribution">
          <DefList
            rows={[
              { label: "Channel summary", value: sourceLine },
              { label: "signup_utm_source", value: toMaybeString(profile.signup_utm_source) ?? "" },
              { label: "signup_utm_medium", value: toMaybeString(profile.signup_utm_medium) ?? "" },
              { label: "signup_utm_campaign", value: toMaybeString(profile.signup_utm_campaign) ?? "" },
              { label: "signup_utm_content", value: toMaybeString(profile.signup_utm_content) ?? "" },
              { label: "signup_utm_term", value: toMaybeString(profile.signup_utm_term) ?? "" },
              { label: "signup_referrer", value: toMaybeString(profile.signup_referrer) ?? "" },
              { label: "signup_landing_page", value: toMaybeString(profile.signup_landing_page) ?? "" },
              { label: "signup_first_seen_at", value: formatDate(toMaybeString(profile.signup_first_seen_at)) },
              { label: "heard_about_source", value: toMaybeString(profile.heard_about_source) ?? "" },
            ]}
          />
        </Section>

        <Section title="Stripe billing / connect">
          <DefList
            rows={[
              { label: "subscription_status", value: toMaybeString(profile.subscription_status) ?? "" },
              { label: "plan_tier", value: toMaybeString(profile.plan_tier) ?? "" },
              { label: "pricing_version", value: toMaybeString(profile.pricing_version) ?? "" },
              { label: "stripe_customer_id", value: toMaybeString(profile.stripe_customer_id) ?? "" },
              { label: "stripe_subscription_id", value: toMaybeString(profile.stripe_subscription_id) ?? "" },
              { label: "stripe_price_id", value: toMaybeString(profile.stripe_price_id) ?? "" },
              {
                label: "subscription_current_period_end",
                value: formatDate(toMaybeString(profile.subscription_current_period_end)),
              },
              { label: "trial_ends_at", value: formatDate(toMaybeString(profile.trial_ends_at)) },
              {
                label: "grace_period_ends_at",
                value: formatDate(toMaybeString(profile.grace_period_ends_at)),
              },
              {
                label: "stripe_connect_account_id",
                value: toMaybeString(profile.stripe_connect_account_id) ?? "",
              },
              {
                label: "connect_onboarding_complete",
                value: String(profile.stripe_connect_onboarding_complete ?? false),
              },
              {
                label: "connect_charges_enabled",
                value: String(profile.stripe_connect_charges_enabled ?? false),
              },
              {
                label: "connect_payouts_enabled",
                value: String(profile.stripe_connect_payouts_enabled ?? false),
              },
              {
                label: "connect_details_submitted",
                value: String(profile.stripe_connect_details_submitted ?? false),
              },
            ]}
          />
        </Section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Jobs created", jobsCount],
            ["Estimates created", estimatesCreated],
            ["Estimates sent", estimatesSent],
            ["Estimates accepted", estimatesAccepted],
            ["Contracts created", contractsCreated],
            ["Contracts sent", contractsSent],
            ["Contracts signed", contractsSigned],
            ["Invoices created", invoicesCreated],
            ["Invoices sent", invoicesSent],
            ["Invoices viewed (count)", invoicesViewed],
            ["Payments recorded", payments.length],
            ["Total invoice amount (non-draft)", formatMoney(totalInvoiceAmount)],
            ["Total payments recorded", formatMoney(totalPaymentsRecorded)],
            ["Outstanding balance (sent / overdue / partial)", formatMoney(outstandingBalance)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-2 text-xl font-semibold text-zinc-900">{value}</p>
            </div>
          ))}
        </section>

        {flags.length > 0 && (
          <Section title="Stuck points / follow-up">
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-amber-900">
              {flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Jobs">
          <TableShell>
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-700">Title</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Customer</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Status</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Contract</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Current total</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                      No jobs
                    </td>
                  </tr>
                ) : (
                  jobs.map((j) => (
                    <tr key={j.id as string} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 font-medium text-zinc-900">{String(j.title ?? "—")}</td>
                      <td className="px-3 py-2 text-zinc-700">
                        {customerMap.get(j.customer_id as string) ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{String(j.status ?? "—")}</td>
                      <td className="px-3 py-2 text-zinc-600">{String(j.contract_status ?? "—")}</td>
                      <td className="px-3 py-2 text-zinc-700">{formatMoney(Number(j.current_contract_total))}</td>
                      <td className="px-3 py-2 text-zinc-500">{formatDate(toMaybeString(j.created_at))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableShell>
        </Section>

        <Section title="Estimates">
          <TableShell>
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-700">#</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Title</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Customer</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Status</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Subtotal</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Tax</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Total</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Sent</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Viewed</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Accepted / Declined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {estimates.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-zinc-500">
                      No estimates
                    </td>
                  </tr>
                ) : (
                  estimates.map((e) => (
                    <tr key={e.id as string} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 text-zinc-800">{String(e.estimate_number ?? "—")}</td>
                      <td className="px-3 py-2 text-zinc-800">{String(e.title ?? "—")}</td>
                      <td className="px-3 py-2 text-zinc-600">
                        {e.customer_id ? customerMap.get(e.customer_id as string) ?? "—" : "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{estimateDisplayStatus(e as Record<string, unknown>)}</td>
                      <td className="px-3 py-2 text-zinc-700">{formatMoney(Number(e.subtotal))}</td>
                      <td className="px-3 py-2 text-zinc-700">{formatMoney(Number(e.tax_amount))}</td>
                      <td className="px-3 py-2 text-zinc-700">{formatMoney(Number(e.total))}</td>
                      <td className="px-3 py-2 text-zinc-500">{formatDate(toMaybeString(e.sent_at))}</td>
                      <td className="px-3 py-2 text-zinc-500">{formatDate(toMaybeString(e.viewed_at))}</td>
                      <td className="px-3 py-2 text-zinc-500">
                        {formatDate(toMaybeString(e.accepted_at))} /{" "}
                        {formatDate(toMaybeString(e.declined_at))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableShell>
        </Section>

        <Section title="Contracts">
          <TableShell>
            <table className="min-w-[800px] w-full text-left text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-700">Job title</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Customer</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Status</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Sent</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Signed</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                      No contracts
                    </td>
                  </tr>
                ) : (
                  contracts.map((c) => (
                    <tr key={c.id as string} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 font-medium text-zinc-900">
                        {String(c.job_title ?? jobMap.get(c.job_id as string)?.title ?? "—")}
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{String(c.customer_name ?? "—")}</td>
                      <td className="px-3 py-2 text-zinc-600">{String(c.status ?? "—")}</td>
                      <td className="px-3 py-2 text-zinc-500">{formatDate(toMaybeString(c.sent_at))}</td>
                      <td className="px-3 py-2 text-zinc-500">{formatDate(toMaybeString(c.signed_at))}</td>
                      <td className="px-3 py-2 text-zinc-700">{formatMoney(Number(c.price))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableShell>
        </Section>

        <Section title="Invoices">
          <TableShell>
            <table className="min-w-[960px] w-full text-left text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-700">Invoice #</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Job</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Customer</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Status</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Total</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Balance due</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Sent</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Viewed</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-zinc-500">
                      No invoices
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const job = jobMap.get(inv.job_id as string) as
                      | { title?: string; customer_id?: string }
                      | undefined;
                    const custName = job?.customer_id
                      ? customerMap.get(job.customer_id as string) ?? "—"
                      : "—";
                    return (
                      <tr key={inv.id as string} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 font-medium text-zinc-900">
                          {String(inv.invoice_number ?? "—")}
                        </td>
                        <td className="px-3 py-2 text-zinc-700">{String(job?.title ?? "—")}</td>
                        <td className="px-3 py-2 text-zinc-600">{custName}</td>
                        <td className="px-3 py-2 text-zinc-600">{String(inv.status ?? "—")}</td>
                        <td className="px-3 py-2 text-zinc-700">{formatMoney(Number(inv.total))}</td>
                        <td className="px-3 py-2 text-zinc-700">{formatMoney(Number(inv.balance_due))}</td>
                        <td className="px-3 py-2 text-zinc-500">{formatDate(toMaybeString(inv.sent_at))}</td>
                        <td className="px-3 py-2 text-zinc-500">{formatDate(toMaybeString(inv.viewed_at))}</td>
                        <td className="px-3 py-2 text-zinc-500">{formatDate(toMaybeString(inv.paid_at))}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </TableShell>
        </Section>

        <Section title="Payments">
          <TableShell>
            <table className="min-w-[960px] w-full text-left text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-700">Invoice #</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Job</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Customer</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Amount</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Paid on</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Method</th>
                  <th className="px-3 py-2 font-medium text-zinc-700">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                      No payments
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => {
                    const inv = invoices.find((i) => i.id === p.invoice_id);
                    const job = inv
                      ? (jobMap.get(inv.job_id as string) as
                          | { title?: string; customer_id?: string }
                          | undefined)
                      : undefined;
                    const custName = job?.customer_id
                      ? customerMap.get(job.customer_id as string) ?? "—"
                      : "—";
                    return (
                      <tr key={p.id as string} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 font-medium text-zinc-900">
                          {String(inv?.invoice_number ?? "—")}
                        </td>
                        <td className="px-3 py-2 text-zinc-700">{String(job?.title ?? "—")}</td>
                        <td className="px-3 py-2 text-zinc-600">{custName}</td>
                        <td className="px-3 py-2 text-zinc-800">{formatMoney(Number(p.amount))}</td>
                        <td className="px-3 py-2 text-zinc-500">{formatDate(toMaybeString(p.paid_on))}</td>
                        <td className="px-3 py-2 text-zinc-600">
                          {paymentMethodLabel(String(p.payment_method ?? ""))}
                        </td>
                        <td className="max-w-[240px] truncate px-3 py-2 text-zinc-600">
                          {toMaybeString(p.note) ?? "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </TableShell>
        </Section>

        <Section title="Recent activity">
          <ul className="mt-3 divide-y divide-zinc-100">
            {activity.length === 0 ? (
              <li className="py-4 text-sm text-zinc-500">No activity rows</li>
            ) : (
              activity.slice(0, 80).map((a, i) => (
                <li key={`${a.label}-${a.at}-${i}`} className="py-2.5 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">{a.label}</span>
                  <span className="mx-2 text-zinc-400">·</span>
                  <span className="text-zinc-500">{formatDate(a.at)}</span>
                </li>
              ))
            )}
          </ul>
        </Section>
      </main>
    </div>
  );
}
