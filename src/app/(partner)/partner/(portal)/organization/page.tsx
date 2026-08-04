import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAppUrl } from "@/lib/stripe";
import {
  buildPartnerReferralUrl,
  isOrganizationPartnerType,
  ORGANIZATION_REWARD_CAD,
  rewardAmountForPartner,
} from "@/lib/partners/constants";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import { computePartnerDashboardStats } from "@/lib/partners/dashboard-stats";
import { getActivePartnerLogo } from "@/lib/partners/studio/actions";
import { CopyButton } from "../copy-button";

export default async function OrganizationPartnerDashboardPage() {
  const session = await getActivePartnerForCurrentUser();
  if (!session) redirect("/login?next=/partner/organization");

  if (!isOrganizationPartnerType(session.partner.partner_type)) {
    redirect("/partner");
  }

  const { partner } = session;
  const supabase = await createClient();
  const [{ data: referrals }, { data: payouts }, { data: campaigns }, logo] =
    await Promise.all([
      supabase
        .from("partner_referrals")
        .select("reward_status, reward_amount, subscription_started_at")
        .eq("partner_id", partner.id),
      supabase
        .from("partner_payouts")
        .select("amount")
        .eq("partner_id", partner.id),
      supabase
        .from("partner_campaigns")
        .select("id, name, created_at, status")
        .eq("partner_id", partner.id)
        .order("created_at", { ascending: false })
        .limit(5),
      getActivePartnerLogo(),
    ]);

  const stats = computePartnerDashboardStats(referrals ?? [], payouts ?? []);
  const referralUrl = buildPartnerReferralUrl(
    resolveAppUrl(),
    partner.referral_code
  );
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(referralUrl)}`;
  const reward = rewardAmountForPartner({
    partner_level: partner.partner_level,
    partner_type: partner.partner_type,
  });

  const pendingReferrals = (referrals ?? []).filter((r) =>
    ["pending", "qualified"].includes(r.reward_status)
  ).length;
  const qualifiedReferrals = (referrals ?? []).filter((r) =>
    ["qualified", "approved", "paid"].includes(r.reward_status)
  ).length;
  const rewardsEarned = (referrals ?? [])
    .filter((r) => ["approved", "paid"].includes(r.reward_status))
    .reduce((sum, r) => sum + Number(r.reward_amount ?? 0), 0);
  const paymentsIssued = stats.totalPaidCad;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2436BB]">
          Organization Partner Program
        </p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-950">
          Organization Dashboard
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {partner.organization_name} · ${reward} CAD per qualified referral
          (Organization Partner rate).
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">
            Organization referral link
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Share this link in newsletters, websites, webinars, and member
            onboarding. Attribution uses the existing Partner Program rules.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-xs font-medium text-zinc-500">Referral URL</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="break-all rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
                  {referralUrl}
                </code>
                <CopyButton text={referralUrl} label="Copy link" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">Referral code</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-800">
                  {partner.referral_code}
                </code>
                <CopyButton text={partner.referral_code} label="Copy code" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">
            Referral QR code
          </h2>
          <div className="mt-4 flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc}
              alt={`Referral QR code for ${partner.organization_name}`}
              className="h-40 w-40 rounded-xl border border-zinc-100 bg-white p-2"
            />
            <a
              href={qrSrc}
              download="organization-referral-qr.png"
              className="text-sm font-semibold text-[#2436BB] hover:underline"
            >
              Download QR
            </a>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Organization logo</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Used automatically in Organization Marketing Studio co-branded graphics.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            {logo?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo.logoUrl}
                alt={`${partner.organization_name} logo`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="px-2 text-center text-xs text-zinc-500">
                No logo uploaded yet
              </span>
            )}
          </div>
          <Link
            href="/partner/studio/create"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2436BB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96]"
          >
            Manage in Marketing Studio
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Pending referrals", value: String(pendingReferrals) },
          { label: "Qualified referrals", value: String(qualifiedReferrals) },
          {
            label: "Rewards earned",
            value: `$${rewardsEarned.toFixed(0)} CAD`,
          },
          {
            label: "Payments issued",
            value: `$${paymentsIssued.toFixed(0)} CAD`,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-zinc-900">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/partner/media#organization-partner-kit"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-[#2436BB]/40"
        >
          <h2 className="text-base font-semibold text-zinc-900">
            Marketing resources
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Open the Organization Partner Kit in the Media Centre.
          </p>
        </Link>
        <Link
          href="/partner/studio"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-[#2436BB]/40"
        >
          <h2 className="text-base font-semibold text-zinc-900">
            Marketing Studio
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Generate co-branded member campaigns (${ORGANIZATION_REWARD_CAD} CAD
            org reward messaging).
          </p>
        </Link>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">Recent campaigns</h2>
          <Link
            href="/partner/studio/history"
            className="text-sm font-semibold text-[#2436BB] hover:underline"
          >
            View all
          </Link>
        </div>
        {(campaigns ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            No campaigns yet. Create your first organization campaign in the
            Marketing Studio.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100">
            {(campaigns ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <Link
                    href={`/partner/studio/campaigns/${c.id}`}
                    className="font-medium text-zinc-900 hover:text-[#2436BB]"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {new Date(c.created_at).toLocaleDateString("en-CA")} ·{" "}
                    {c.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="coming-soon-heading">
        <h2
          id="coming-soon-heading"
          className="text-lg font-semibold text-zinc-900"
        >
          Analytics
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {["Member Engagement", "Campaign Performance", "Referral Analytics"].map(
            (label) => (
              <div
                key={label}
                className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4"
              >
                <p className="text-sm font-semibold text-zinc-800">{label}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#F28C38]">
                  Coming Soon
                </p>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}
