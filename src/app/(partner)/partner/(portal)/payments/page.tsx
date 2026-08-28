import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import { computePartnerDashboardStats } from "@/lib/partners/dashboard-stats";
import { formatBillingDateOrDash } from "@/lib/billing-date-display";
import { PartnerPaymentEmailForm } from "./payment-email-form";

export default async function PartnerPaymentsPage() {
  const session = await getActivePartnerForCurrentUser();
  if (!session) redirect("/login?next=/partner/payments");

  const supabase = await createClient();
  const [{ data: referrals }, { data: payouts }] = await Promise.all([
    supabase
      .from("partner_referrals")
      .select("reward_status, reward_amount, subscription_started_at")
      .eq("partner_id", session.partner.id),
    supabase
      .from("partner_payouts")
      .select("amount, payment_method, payment_reference, notes, paid_at")
      .eq("partner_id", session.partner.id)
      .order("paid_at", { ascending: false }),
  ]);

  const stats = computePartnerDashboardStats(referrals ?? [], payouts ?? []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Earnings</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Track rewards from referral through qualification to Interac e-Transfer
          payout. Statuses show as Pending qualification, Qualified, or Paid.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Pending qualification"
          value={`$${stats.pendingAmountCad.toFixed(0)} CAD`}
        />
        <Stat
          label="Qualified"
          value={`$${(stats.qualifiedAmountCad + stats.approvedAmountCad).toFixed(0)} CAD`}
        />
        <Stat label="Total earned (paid)" value={`$${stats.totalPaidCad.toFixed(0)} CAD`} />
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Payment details</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Add a payment email before JobProof can send your first referral reward.
        </p>
        <div className="mt-4">
          <PartnerPaymentEmailForm initialEmail={session.partner.payment_email} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Payment history</h2>
        {(payouts ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No payouts recorded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100">
            {(payouts ?? []).map((p, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-900">
                    ${Number(p.amount).toFixed(2)} CAD
                  </p>
                  <p className="text-zinc-500">
                    {formatBillingDateOrDash(p.paid_at)}
                    {p.payment_method ? ` · ${p.payment_method}` : ""}
                    {p.payment_reference ? ` · Ref ${p.payment_reference}` : ""}
                  </p>
                  {p.notes ? <p className="text-zinc-500">{p.notes}</p> : null}
                </div>
                <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  Paid
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-zinc-900">{value}</p>
    </div>
  );
}
