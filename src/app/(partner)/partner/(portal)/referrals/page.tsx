import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import { rewardStatusLabel, type PartnerRewardStatus } from "@/lib/partners/constants";
import { formatBillingDateOrDash } from "@/lib/billing-date-display";

export default async function PartnerReferralsPage() {
  const session = await getActivePartnerForCurrentUser();
  if (!session) redirect("/login?next=/partner/referrals");

  const supabase = await createClient();
  const { data: referrals } = await supabase
    .from("partner_referrals")
    .select(
      "contractor_business_name, signup_date, trial_started_at, subscription_started_at, qualification_date, reward_status, reward_amount, reward_paid_at"
    )
    .eq("partner_id", session.partner.id)
    .order("signup_date", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Referrals</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Track each contractor from signup through reward payout. Plan details are not shown.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Business name</th>
              <th className="px-4 py-3">Signup</th>
              <th className="px-4 py-3">Trial</th>
              <th className="px-4 py-3">Subscribed</th>
              <th className="px-4 py-3">Qualified</th>
              <th className="px-4 py-3">Reward status</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Paid</th>
            </tr>
          </thead>
          <tbody>
            {(referrals ?? []).length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  No referrals yet. Share your link to get started.
                </td>
              </tr>
            ) : (
              (referrals ?? []).map((r, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {r.contractor_business_name?.trim() || "Contractor"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatBillingDateOrDash(r.signup_date)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {r.trial_started_at ? formatBillingDateOrDash(r.trial_started_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {r.subscription_started_at
                      ? formatBillingDateOrDash(r.subscription_started_at)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {r.qualification_date
                      ? formatBillingDateOrDash(r.qualification_date)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {rewardStatusLabel(r.reward_status as PartnerRewardStatus)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    ${Number(r.reward_amount).toFixed(0)} CAD
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {r.reward_paid_at ? formatBillingDateOrDash(r.reward_paid_at) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
