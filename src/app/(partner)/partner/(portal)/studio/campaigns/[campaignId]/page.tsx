import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import { getPartnerCampaignDetail } from "@/lib/partners/studio/actions";
import { StudioAssetCard } from "@/components/partners/studio/studio-asset-card";
import { StudioCopyVariantBar } from "@/components/partners/studio/studio-copy-variant-bar";
import { isOrganizationPartnerType } from "@/lib/partners/constants";
import {
  STUDIO_AUDIENCES,
  STUDIO_GOALS,
  STUDIO_STYLES,
  STUDIO_THEMES,
  studioOptionLabel,
} from "@/lib/partners/studio/catalog";
import { FoundingPartnerBadge } from "@/components/partners/founding-partner-badge";

export default async function PartnerStudioCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const session = await getActivePartnerForCurrentUser();
  if (!session) redirect("/login?next=/partner/studio");

  const { campaignId } = await params;
  const campaign = await getPartnerCampaignDetail(campaignId);
  if (!campaign) notFound();
  const isOrg = isOrganizationPartnerType(session.partner.partner_type);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/partner/studio"
          className="text-sm font-medium text-[#2436BB] hover:underline"
        >
          ← Marketing Studio
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-950">{campaign.name}</h1>
          {!isOrg && session.partner.partner_level === "founding" ? (
            <FoundingPartnerBadge />
          ) : null}
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          {studioOptionLabel(STUDIO_THEMES, campaign.theme)} ·{" "}
          {studioOptionLabel(STUDIO_AUDIENCES, campaign.audience)} ·{" "}
          {studioOptionLabel(STUDIO_GOALS, campaign.goal)} ·{" "}
          {studioOptionLabel(STUDIO_STYLES, campaign.style)}
        </p>
        <p className="mt-2 break-all text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">Referral link:</span>{" "}
          <a
            href={campaign.referral_url}
            className="text-[#2436BB] hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {campaign.referral_url}
          </a>
        </p>
        <p className="mt-1 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">Referral code:</span>{" "}
          {campaign.referral_code}
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          Recommended by {session.partner.organization_name}
          {!isOrg && session.partner.partner_level === "founding"
            ? " · Founding Partner"
            : ""}{" "}
          · Powered by JobProof
        </p>
      </div>

      <StudioCopyVariantBar
        campaignId={campaign.id}
        currentVariant={campaign.copy_variant}
      />

      <section>
        <h2 className="mb-4 text-xl font-bold text-zinc-950">Campaign dashboard</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {campaign.assets.map((asset) => (
            <StudioAssetCard
              key={asset.id}
              campaignId={campaign.id}
              asset={asset}
              referralUrl={campaign.referral_url}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Campaign analytics</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Clicks, signups, qualified referrals, and revenue tracking are coming soon.
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Coming Soon
        </p>
      </section>
    </div>
  );
}
