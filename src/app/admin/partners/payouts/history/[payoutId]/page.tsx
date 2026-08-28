import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUserOrRedirectLogin } from "@/lib/admin-auth";
import { AdminNotAuthorized } from "@/app/admin/NotAuthorized";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { adminRewardStatusLabel, type PartnerRewardStatus } from "@/lib/partners/constants";
import { PARTNER_PAYMENT_METHOD_LABEL } from "@/lib/partners/payment-details";
import { formatAdminDate } from "@/lib/partners/admin-application-review";

export default async function AdminPayoutHistoryDetailPage({
  params,
}: {
  params: Promise<{ payoutId: string }>;
}) {
  const { payoutId } = await params;
  const auth = await requireAdminUserOrRedirectLogin();
  if (!auth.ok) return <AdminNotAuthorized userEmail={auth.userEmail ?? ""} />;

  const admin = createServiceRoleClient();
  if (!admin) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <p className="text-red-700">Service role unavailable.</p>
      </div>
    );
  }

  const [{ data: payout }, { data: referrals }] = await Promise.all([
    admin
      .from("partner_payouts")
      .select(
        "id, partner_id, amount, referral_count, payment_method, payment_email, payment_reference, notes, paid_at, created_by, partners(organization_name, contact_name)"
      )
      .eq("id", payoutId)
      .maybeSingle(),
    admin
      .from("partner_referrals")
      .select(
        "id, contractor_business_name, signup_date, qualification_date, reward_amount, reward_status, reward_paid_at"
      )
      .eq("payout_id", payoutId)
      .order("qualification_date", { ascending: true }),
  ]);

  if (!payout) notFound();

  const pe = payout.partners as
    | { organization_name?: string; contact_name?: string }
    | { organization_name?: string; contact_name?: string }[]
    | null;
  const partnerEmbed = Array.isArray(pe) ? pe[0] : pe;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Link
        href="/admin/partners/payouts"
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
      >
        ← Payouts
      </Link>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">
          {partnerEmbed?.organization_name ?? "Partner payout"}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">{partnerEmbed?.contact_name}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Paid</dt>
            <dd>{formatAdminDate(payout.paid_at)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Amount</dt>
            <dd className="font-semibold">${Number(payout.amount).toFixed(2)} CAD</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Referrals</dt>
            <dd>{Number(payout.referral_count ?? referrals?.length ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Method</dt>
            <dd>{payout.payment_method || PARTNER_PAYMENT_METHOD_LABEL}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Payment email</dt>
            <dd className="break-all">{payout.payment_email || "—"}</dd>
          </div>
          {payout.payment_reference ? (
            <div>
              <dt className="text-zinc-500">Reference</dt>
              <dd>{payout.payment_reference}</dd>
            </div>
          ) : null}
          {payout.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Notes</dt>
              <dd>{payout.notes}</dd>
            </div>
          ) : null}
          {payout.created_by ? (
            <div>
              <dt className="text-zinc-500">Recorded by</dt>
              <dd>{payout.created_by}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Included referrals</h2>
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {(referrals ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-zinc-900">{r.contractor_business_name || "—"}</p>
                <p className="text-zinc-500">
                  Qualified {formatAdminDate(r.qualification_date)} · $
                  {Number(r.reward_amount).toFixed(0)} CAD (snapshot)
                </p>
              </div>
              <span className="text-xs text-zinc-500">
                {adminRewardStatusLabel(r.reward_status as PartnerRewardStatus)}
              </span>
            </li>
          ))}
        </ul>
        {(referrals ?? []).length === 0 ? (
          <p className="text-sm text-amber-800">
            No referrals are linked to this payout. This may be a legacy single-referral record.
          </p>
        ) : null}
      </section>
    </div>
  );
}
