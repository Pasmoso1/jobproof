import { JobProofLogo } from "@/components/jobproof-logo";
import { QuoteRequestsNavLink } from "@/components/quote-requests-nav-link";
import { TrialStatusBanner } from "@/components/trial-status-banner";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getNewQuoteRequestCount } from "@/lib/quote-requests/response-alerts";
import { redirect } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { getFeedbackMailtoHref } from "@/lib/onboarding-feedback";

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

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <JobProofLogo className="h-8 w-auto" />
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Dashboard
            </Link>
            <Link
              href="/collections"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Collections
            </Link>
            <Link
              href="/estimates"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Estimates
            </Link>
            <QuoteRequestsNavLink newCount={newQuoteRequestCount} />
            <Link
              href="/jobs/create"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Create Job
            </Link>
            <Link
              href="/settings/business"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Settings
            </Link>
            <Link
              href="/settings/billing"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Billing
            </Link>
            <a
              href={getFeedbackMailtoHref()}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              Send feedback
            </a>
            <LogoutButton />
          </nav>
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
