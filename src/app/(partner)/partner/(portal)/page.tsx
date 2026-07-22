import { createClient } from "@/lib/supabase/server";
import { resolveAppUrl } from "@/lib/stripe";
import {
  buildPartnerReferralUrl,
  partnerLevelLabel,
  rewardAmountForLevel,
} from "@/lib/partners/constants";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import { computePartnerDashboardStats } from "@/lib/partners/dashboard-stats";
import { CopyButton } from "./copy-button";
import { redirect } from "next/navigation";
import { FoundingPartnerBadge } from "@/components/partners/founding-partner-badge";

export default async function PartnerDashboardPage() {
  const session = await getActivePartnerForCurrentUser();
  if (!session) redirect("/login?next=/partner");
  const { partner } = session;

  const supabase = await createClient();
  const [{ data: referrals }, { data: payouts }] = await Promise.all([
    supabase
      .from("partner_referrals")
      .select("reward_status, reward_amount, subscription_started_at")
      .eq("partner_id", partner.id),
    supabase.from("partner_payouts").select("amount").eq("partner_id", partner.id),
  ]);

  const stats = computePartnerDashboardStats(referrals ?? [], payouts ?? []);
  const referralUrl = buildPartnerReferralUrl(resolveAppUrl(), partner.referral_code);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(referralUrl)}`;
  const reward = rewardAmountForLevel(partner.partner_level);

  const cards = [
    { label: "Total Referrals", value: String(stats.totalReferrals) },
    { label: "Active Subscribers", value: String(stats.activeSubscribers) },
    { label: "Pending Rewards", value: String(stats.pendingRewards) },
    { label: "Approved Rewards", value: String(stats.approvedRewards) },
    { label: "Total Paid", value: `$${stats.totalPaidCad.toFixed(0)} CAD` },
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
          {partner.partner_level === "founding" ? <FoundingPartnerBadge /> : null}
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          {partnerLevelLabel(partner.partner_level)} · ${reward} CAD per qualified referral.
          A referral qualifies after 90 consecutive days as a paying subscriber; rewards are
          reviewed and paid manually, with no recurring commissions.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{c.label}</p>
            <p className="mt-2 text-2xl font-bold text-zinc-900">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">My referral link</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Share your referral link with contractors who are a good fit for JobProof. Referral
          quality matters more than signup volume. Once they remain a paying subscriber for 90
          consecutive days, the reward becomes eligible for manual review and approval.
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-xs font-medium text-zinc-500">Referral URL</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="block max-w-full truncate rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800">
                  {referralUrl}
                </code>
                <CopyButton text={referralUrl} />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">Referral code</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900">
                  {partner.referral_code}
                </code>
                <CopyButton text={partner.referral_code} />
              </div>
            </div>
          </div>
          <div className="shrink-0 rounded-lg border border-zinc-200 bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="Referral QR code" width={160} height={160} className="h-40 w-40" />
          </div>
        </div>
      </section>
    </div>
  );
}
