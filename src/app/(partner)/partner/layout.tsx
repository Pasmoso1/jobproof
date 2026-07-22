import Link from "next/link";
import { redirect } from "next/navigation";
import { JobProofLogo } from "@/components/jobproof-logo";
import { createClient } from "@/lib/supabase/server";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import { partnerLevelLabel } from "@/lib/partners/constants";
import { LogoutButton } from "@/app/(app)/logout-button";
import { FoundingPartnerBadge } from "@/components/partners/founding-partner-badge";

const NAV = [
  { href: "/partner", label: "Dashboard" },
  { href: "/partner/referrals", label: "Referrals" },
  { href: "/partner/payments", label: "Payments" },
  { href: "/partner/media", label: "Media Center" },
  { href: "/partner/resources", label: "Resources" },
  { href: "/partner/training", label: "Training" },
  { href: "/partner/faq", label: "FAQ" },
];

export default async function PartnerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/partner");
  }

  const session = await getActivePartnerForCurrentUser();
  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <header className="border-b border-zinc-200 bg-white px-4 py-4">
          <Link href="/">
            <JobProofLogo className="h-8 w-auto" />
          </Link>
        </header>
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Partner access required</h1>
          <p className="mt-3 text-zinc-600">
            This account is not linked to an approved JobProof partner profile. Sign in with the
            email from your partner approval, or apply to the program.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/partners"
              className="rounded-xl bg-[#2436BB] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Partner Program
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900"
            >
              Contractor dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { partner } = session;

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
              {partner.partner_level === "founding" ? (
                <FoundingPartnerBadge className="hidden sm:inline-flex" />
              ) : (
                <span className="hidden text-zinc-600 sm:inline">
                  {partnerLevelLabel(partner.partner_level)}
                </span>
              )}
              <LogoutButton />
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-4 gap-y-2">
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
