import Link from "next/link";
import { requireAdminUserOrRedirectLogin } from "@/lib/admin-auth";
import { AdminNotAuthorized } from "@/app/admin/NotAuthorized";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  aggregateReadyPayoutsByPartner,
  computePayoutDashboardTotals,
  type ReferralPayoutRow,
} from "@/lib/partners/payout-batch";
import { type PartnerRewardStatus } from "@/lib/partners/constants";
import {
  PayoutDashboardClient,
  type NeedsReviewRow,
  type PayoutHistoryRow,
  type ReadyPartnerRow,
} from "./payout-dashboard-client";

export default async function AdminPartnerPayoutsPage() {
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

  const [{ data: partners }, { data: referrals }, { data: payouts }] = await Promise.all([
    admin
      .from("partners")
      .select("id, organization_name, contact_name, payment_email, status")
      .eq("status", "active")
      .order("organization_name"),
    admin
      .from("partner_referrals")
      .select(
        "id, partner_id, contractor_business_name, signup_date, subscription_started_at, qualification_date, reward_amount, reward_status, verification_notes, payout_id, partners(organization_name)"
      )
      .in("reward_status", ["approved", "needs_review"])
      .is("payout_id", null),
    admin
      .from("partner_payouts")
      .select(
        "id, partner_id, amount, referral_count, payment_method, payment_email, paid_at, partners(organization_name)"
      )
      .order("paid_at", { ascending: false })
      .limit(100),
  ]);

  const referralRows: ReferralPayoutRow[] = (referrals ?? []).map((r) => ({
    id: String(r.id),
    partner_id: String(r.partner_id),
    contractor_business_name: r.contractor_business_name,
    signup_date: r.signup_date,
    subscription_started_at: r.subscription_started_at,
    qualification_date: r.qualification_date,
    reward_amount: Number(r.reward_amount),
    reward_status: r.reward_status as PartnerRewardStatus,
    verification_notes: r.verification_notes ?? null,
    payout_id: r.payout_id,
  }));

  const readySummaries = aggregateReadyPayoutsByPartner({
    referrals: referralRows,
    partners: (partners ?? []).map((p) => ({
      id: String(p.id),
      organization_name: p.organization_name,
      contact_name: p.contact_name,
      payment_email: p.payment_email,
    })),
  });

  const needsReviewReferrals = referralRows.filter((r) => r.reward_status === "needs_review");
  const totals = computePayoutDashboardTotals({
    readySummaries,
    needsReviewReferrals,
  });

  const readyPartners: ReadyPartnerRow[] = readySummaries.map((s) => ({
    partnerId: s.partnerId,
    organizationName: s.organizationName,
    paymentEmail: s.paymentEmail,
    readyCount: s.readyCount,
    readyAmountCad: s.readyAmountCad,
    missingPaymentEmail: s.missingPaymentEmail,
  }));

  const needsReview: NeedsReviewRow[] = needsReviewReferrals.map((r) => {
    const partner = (partners ?? []).find((p) => String(p.id) === r.partner_id);
    return {
      id: r.id,
      partnerId: r.partner_id,
      partnerName: partner?.organization_name ?? "—",
      contractorName: r.contractor_business_name,
      rewardAmount: r.reward_amount,
      qualificationDate: r.qualification_date,
      verificationNotes: r.verification_notes,
    };
  });

  const history: PayoutHistoryRow[] = (payouts ?? []).map((p) => {
    const pe = p.partners as { organization_name?: string } | { organization_name?: string }[] | null;
    const partnerEmbed = Array.isArray(pe) ? pe[0] : pe;
    return {
      id: String(p.id),
      partnerId: String(p.partner_id),
      partnerName: partnerEmbed?.organization_name ?? "—",
      amount: Number(p.amount),
      referralCount: Number(p.referral_count ?? 1),
      paymentMethod: p.payment_method,
      paymentEmail: p.payment_email,
      paidAt: p.paid_at,
    };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <Link href="/admin/partners" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Partner Program
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Payouts</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Group ready rewards by partner, send one Interac e-Transfer per partner, then record
          payment here. Amounts are calculated from live referral records.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Partners awaiting payment" value={String(totals.partnersAwaitingPayment)} />
        <SummaryCard label="Rewards ready" value={String(totals.rewardsReady)} />
        <SummaryCard
          label="Total amount owed"
          value={`$${totals.totalOwedCad.toFixed(0)} CAD`}
        />
        <SummaryCard label="Needs review" value={String(totals.needsReviewCount)} />
      </div>

      {totals.partnersMissingPaymentEmail > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {totals.partnersMissingPaymentEmail} partner
          {totals.partnersMissingPaymentEmail === 1 ? "" : "s"} ha
          {totals.partnersMissingPaymentEmail === 1 ? "s" : "ve"} ready rewards but no payment
          email on file. Payout cannot be recorded until the partner adds one in the Partner
          Portal.
        </p>
      ) : null}

      <PayoutDashboardClient
        readyPartners={readyPartners}
        needsReview={needsReview}
        history={history}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-zinc-900">{value}</p>
    </div>
  );
}
