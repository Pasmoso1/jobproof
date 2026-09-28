import { JobProofLogo } from "@/components/jobproof-logo";
import { QuoteRequestsNavLink } from "@/components/quote-requests-nav-link";
import { TrialStatusBanner } from "@/components/trial-status-banner";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getNewQuoteRequestCount } from "@/lib/quote-requests/response-alerts";
import { redirect } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { getFeedbackMailtoHref } from "@/lib/onboarding-feedback";
import {
  SignupVerifiedPendingBridge,
  TrialStartedPendingBridge,
} from "@/components/contractor-onboarding-analytics";
import { AppMobileNav } from "@/components/app-mobile-nav";
import { getAppNavLinks } from "@/lib/app-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      `
      id,
      beta_tester,
      subscription_status,
      stripe_subscription_id,
      trial_started_at,
      trial_ends_at,
      trial_plan_tier,
      plan_tier,
      trial_expired_screen_seen_at,
      business_name,
      phone,
      address_line_1,
      city,
      province,
      postal_code,
      quote_primary_trade
    `
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const newQuoteRequestCount = profile?.id
    ? await getNewQuoteRequestCount(String(profile.id))
    : 0;

  const email = user.email?.trim().toLowerCase() ?? "";
  let showPartnerPortal = false;
  if (email) {
    if (profile?.id) {
      const { data: byProfile } = await supabase
        .from("partners")
        .select("id")
        .eq("status", "active")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (byProfile) showPartnerPortal = true;
    }
    if (!showPartnerPortal) {
      const { data: byEmail } = await supabase
        .from("partners")
        .select("id")
        .eq("status", "active")
        .ilike("email", email)
        .maybeSingle();
      if (byEmail) showPartnerPortal = true;
    }
  }

  const navLinks = getAppNavLinks({ showPartnerPortal });
  const feedbackHref = getFeedbackMailtoHref();

  return (
    <div className="min-h-screen bg-zinc-50">
      <SignupVerifiedPendingBridge />
      <TrialStartedPendingBridge />
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <JobProofLogo className="h-8 w-auto" />
          </Link>
          <nav
            aria-label="Main"
            className="hidden flex-wrap items-center justify-end gap-x-4 gap-y-2 lg:flex"
          >
            {navLinks.map((link) =>
              link.key === "quote-requests" ? (
                <QuoteRequestsNavLink key={link.key} newCount={newQuoteRequestCount} />
              ) : (
                <Link
                  key={link.key}
                  href={link.href}
                  className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
                >
                  {link.label}
                </Link>
              )
            )}
            <a
              href={feedbackHref}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              Send feedback
            </a>
            <LogoutButton />
          </nav>
          <div className="lg:hidden">
            <AppMobileNav
              showPartnerPortal={showPartnerPortal}
              newQuoteRequestCount={newQuoteRequestCount}
              feedbackHref={feedbackHref}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {profile ? (
          <div className="mb-4">
            <TrialStatusBanner profile={profile} accountEmail={user.email ?? ""} />
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
