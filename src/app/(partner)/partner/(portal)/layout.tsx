import Link from "next/link";
import { redirect } from "next/navigation";
import { JobProofLogo } from "@/components/jobproof-logo";
import { getPartnerAccountStatusForCurrentUser } from "@/lib/partners/session";
import { resolvePartnerEntryPath } from "@/lib/partners/login-href";
import {
  isOrganizationPartnerType,
  partnerLevelLabel,
  partnerTypeLabel,
} from "@/lib/partners/constants";
import { LogoutButton } from "@/app/(app)/logout-button";
import { FoundingPartnerBadge } from "@/components/partners/founding-partner-badge";

const NAV = [
  { href: "/partner", label: "Dashboard" },
  { href: "/partner/studio", label: "Marketing Studio" },
  { href: "/partner/media", label: "Media Centre" },
  { href: "/partner/resources", label: "Resources" },
  { href: "/partner/referrals", label: "Referrals" },
  { href: "/partner/payments", label: "Earnings" },
  { href: "/partner/training", label: "Training" },
  { href: "/partner/faq", label: "FAQ" },
] as const;

/** Protected Partner Portal chrome — requires active + email-verified partner. */
export default async function PartnerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await getPartnerAccountStatusForCurrentUser();
  if (account.kind !== "active" || !account.emailVerified) {
    redirect(
      resolvePartnerEntryPath({
        kind: account.kind,
        emailVerified: "emailVerified" in account ? account.emailVerified : false,
      })
    );
  }

  const { partner } = account;
  const isOrg = isOrganizationPartnerType(partner.partner_type);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <Link href="/partner" className="flex items-center gap-2">
              <JobProofLogo className="h-8 w-auto" />
              <span className="hidden text-sm font-semibold text-zinc-700 sm:inline">
                Partner Portal
              </span>
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-zinc-600 md:inline">
                {partner.organization_name}
              </span>
              <span className="hidden text-xs font-medium text-zinc-500 sm:inline">
                {partnerTypeLabel(partner.partner_type)}
              </span>
              {!isOrg && partner.partner_level === "founding" ? (
                <FoundingPartnerBadge className="hidden sm:inline-flex" />
              ) : !isOrg ? (
                <span className="hidden text-zinc-600 lg:inline">
                  {partnerLevelLabel(partner.partner_level)}
                </span>
              ) : null}
              <LogoutButton />
            </div>
          </div>
          <nav
            className="flex flex-wrap gap-x-4 gap-y-2"
            aria-label="Partner portal"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
