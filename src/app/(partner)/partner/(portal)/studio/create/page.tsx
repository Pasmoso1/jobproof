import Link from "next/link";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import { redirect } from "next/navigation";
import {
  isOrganizationPartnerType,
  normalizePartnerType,
} from "@/lib/partners/constants";
import { getActivePartnerLogo } from "@/lib/partners/studio/actions";
import { StudioCampaignWizard } from "@/components/partners/studio/studio-campaign-wizard";

export default async function PartnerStudioCreatePage() {
  const session = await getActivePartnerForCurrentUser();
  if (!session) redirect("/login?next=/partner/studio/create");

  const logo = await getActivePartnerLogo();
  const isOrganizationPartner = isOrganizationPartnerType(
    session.partner.partner_type
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/partner/studio"
          className="text-sm font-medium text-[#2436BB] hover:underline"
        >
          ← Marketing Studio
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-950">
          Create Campaign
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {isOrganizationPartner
            ? "Generate member-focused campaigns with your organization logo, referral link, and QR code."
            : "Follow the wizard to generate personalized JobProof marketing assets for your partner type."}
        </p>
      </div>

      <StudioCampaignWizard
        organizationName={session.partner.organization_name}
        isFounding={session.partner.partner_level === "founding"}
        initialLogoUrl={logo?.logoUrl ?? null}
        isOrganizationPartner={isOrganizationPartner}
        partnerType={normalizePartnerType(session.partner.partner_type)}
      />
    </div>
  );
}
