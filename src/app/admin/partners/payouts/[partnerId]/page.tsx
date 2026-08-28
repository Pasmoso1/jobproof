import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUserOrRedirectLogin } from "@/lib/admin-auth";
import { AdminNotAuthorized } from "@/app/admin/NotAuthorized";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sumRewardAmounts } from "@/lib/partners/payout-batch";
import type { PartnerRewardStatus } from "@/lib/partners/constants";
import {
  PartnerPayoutDetailClient,
  type PartnerPayoutReferralRow,
} from "./partner-payout-detail-client";

export default async function AdminPartnerPayoutDetailPage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const { partnerId } = await params;
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

  const [{ data: partner }, { data: referrals }] = await Promise.all([
    admin
      .from("partners")
      .select("id, organization_name, contact_name, payment_email")
      .eq("id", partnerId)
      .maybeSingle(),
    admin
      .from("partner_referrals")
      .select(
        "id, contractor_business_name, signup_date, subscription_started_at, qualification_date, reward_amount, reward_status, verification_notes"
      )
      .eq("partner_id", partnerId)
      .eq("reward_status", "approved")
      .is("payout_id", null)
      .order("qualification_date", { ascending: true }),
  ]);

  if (!partner) notFound();

  const rows: PartnerPayoutReferralRow[] = (referrals ?? []).map((r) => ({
    id: String(r.id),
    contractorName: r.contractor_business_name,
    signupDate: r.signup_date,
    subscriptionStartedAt: r.subscription_started_at,
    qualificationDate: r.qualification_date,
    rewardAmount: Number(r.reward_amount),
    rewardStatus: r.reward_status as PartnerRewardStatus,
    verificationNotes: r.verification_notes,
  }));

  const totalAmountCad = sumRewardAmounts(
    rows.map((r) => ({ reward_amount: r.rewardAmount }))
  );

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link
        href="/admin/partners/payouts"
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
      >
        ← Payouts
      </Link>
      <div className="mt-4">
        <PartnerPayoutDetailClient
          partnerId={partnerId}
          organizationName={partner.organization_name}
          contactName={partner.contact_name}
          paymentEmail={partner.payment_email}
          referrals={rows}
          totalAmountCad={totalAmountCad}
        />
      </div>
    </div>
  );
}
