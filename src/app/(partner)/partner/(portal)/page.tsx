import { createClient } from "@/lib/supabase/server";
import { resolveAppUrl } from "@/lib/stripe";
import {
  buildPartnerReferralUrl,
  isOrganizationPartnerType,
  partnerLevelLabel,
  partnerTypeMeta,
  rewardAmountForPartner,
} from "@/lib/partners/constants";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import { computePartnerDashboardStats } from "@/lib/partners/dashboard-stats";
import { CopyButton } from "./copy-button";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FoundingPartnerBadge } from "@/components/partners/founding-partner-badge";
import { OrganizationPartnerCallout } from "@/components/partners/organization-partner-callout";
import {
  PARTNER_MISSING_PAYMENT_EMAIL_PROMPT,
  hasPartnerPaymentEmail,
} from "@/lib/partners/payment-details";

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
  const reward = rewardAmountForPartner({
    partner_level: partner.partner_level,
    partner_type: partner.partner_type,
  });
  const typeMeta = partnerTypeMeta(partner.partner_type);
  const isOrg = isOrganizationPartnerType(partner.partner_type);

  const cards = [
    { label: "Referred", value: String(stats.referredCount) },
    { label: "Qualified", value: String(stats.qualifiedCount) },
    { label: "Pending reward", value: String(stats.pendingRewardCount) },
    { label: "Approved reward", value: String(stats.approvedRewardCount) },
    { label: "Paid", value: `$${stats.totalPaidCad.toFixed(0)} CAD` },
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
          {!isOrg && partner.partner_level === "founding" ? <FoundingPartnerBadge /> : null}
        </div>
        <p className="mt-2 text-base font-medium text-zinc-800">
          {typeMeta.dashboardIntro}
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          {typeMeta.shortLabel}
          {!isOrg ? ` · ${partnerLevelLabel(partner.partner_level)}` : null} · $
          {reward} CAD per qualified referral. A referral qualifies after 90
          consecutive days as a paying subscriber; rewards are reviewed and
          approved by JobProof before payment, with no recurring commissions.
        </p>
        {!hasPartnerPaymentEmail(partner.payment_email) ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {PARTNER_MISSING_PAYMENT_EMAIL_PROMPT}{" "}
            <Link
              href="/partner/payments"
              className="font-semibold text-[#2436BB] underline hover:no-underline"
            >
              Add payment email
            </Link>
          </p>
        ) : null}
        {isOrg ? null : <OrganizationPartnerCallout className="mt-4" />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {c.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-zinc-900">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">My referral link</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Share your referral link with contractors who are a good fit for JobProof.
          Referral quality matters more than signup volume. Once they remain a paying
          subscriber for 90 consecutive days, the reward becomes eligible for JobProof
          review and approval.
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
            <img
              src={qrSrc}
              alt="Referral QR code"
              width={160}
              height={160}
              className="h-40 w-40"
            />
          </div>
        </div>
      </section>

      {isOrg ? (
        <section className="rounded-xl border border-[#2436BB]/20 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">
            Organization tools
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Co-branded member resources stay in the Media Centre and Marketing
            Studio. Use the organization hub for kit downloads and upcoming
            member analytics.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/partner/organization"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2436BB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96]"
            >
              Organization hub
            </Link>
            <Link
              href="/partner/media#organization-partner-kit"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              Partner Kit
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
