import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import { partnerFacingRewardStatusLabel, type PartnerRewardStatus } from "@/lib/partners/constants";
import { formatBillingDateOrDash } from "@/lib/billing-date-display";
import { PARTNER_PAYMENT_METHOD_LABEL } from "@/lib/partners/payment-details";

export default async function PartnerPayoutDetailPage({
  params,
}: {
  params: Promise<{ payoutId: string }>;
}) {
  const { payoutId } = await params;
  const session = await getActivePartnerForCurrentUser();
  if (!session) redirect("/login?next=/partner/payments");

  const supabase = await createClient();
  const [{ data: payout }, { data: referrals }] = await Promise.all([
    supabase
      .from("partner_payouts")
      .select("id, amount, payment_method, paid_at, referral_count, partner_id")
      .eq("id", payoutId)
      .eq("partner_id", session.partner.id)
      .maybeSingle(),
    supabase
      .from("partner_referrals")
      .select(
        "contractor_business_name, qualification_date, reward_amount, reward_status"
      )
      .eq("payout_id", payoutId)
      .order("qualification_date", { ascending: true }),
  ]);

  if (!payout) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/partner/payments" className="text-sm font-medium text-[#2436BB]">
          ← Earnings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Payout details</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {formatBillingDateOrDash(payout.paid_at)} · $
          {Number(payout.amount).toFixed(2)} CAD ·{" "}
          {payout.payment_method || PARTNER_PAYMENT_METHOD_LABEL}
        </p>
      </div>

      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
        {(referrals ?? []).map((r, i) => (
          <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-zinc-900">{r.contractor_business_name || "—"}</p>
              <p className="text-zinc-500">
                Qualified {formatBillingDateOrDash(r.qualification_date)} · $
                {Number(r.reward_amount).toFixed(0)} CAD
              </p>
            </div>
            <span className="text-xs text-zinc-600">
              {partnerFacingRewardStatusLabel(r.reward_status as PartnerRewardStatus)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
