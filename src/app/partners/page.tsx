import type { Metadata } from "next";
import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";
import {
  FOUNDING_PARTNER_LIMIT,
  FOUNDING_REWARD_CAD,
  STANDARD_REWARD_CAD,
} from "@/lib/partners/constants";
import { PARTNER_LANDING_FAQS } from "@/lib/partners/content/faqs";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { countFoundingPartners } from "@/lib/partners/approve";
import { FoundingPartnerSectionTracker } from "@/components/partners/partner-public-analytics";
import { FoundingPartnerBadge } from "@/components/partners/founding-partner-badge";

export const metadata: Metadata = {
  title: "JobProof Partner Program",
  description:
    "Partner with JobProof to refer quality contractors. Invitation-based rewards for trusted industry partners.",
};

export const dynamic = "force-dynamic";

export default async function PartnersLandingPage() {
  const admin = createServiceRoleClient();
  const foundingCount = admin
    ? await countFoundingPartners(admin)
    : FOUNDING_PARTNER_LIMIT;
  const foundingAvailable = foundingCount < FOUNDING_PARTNER_LIMIT;
  const foundingRemaining = Math.max(0, FOUNDING_PARTNER_LIMIT - foundingCount);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-200 px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/">
            <JobProofLogo />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/partners/apply" className="font-medium text-[#2436BB] hover:text-[#1c2a96]">
              Apply
            </Link>
            <Link href="/login" className="font-medium text-zinc-600 hover:text-zinc-900">
              Partner sign in
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-white px-6 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#2436BB]">
              Partner Program
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
              Refer contractors you already work with
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-zinc-600">
              JobProof partners with trusted people and organizations who regularly support
              independent contractors. Share a referral link. Earn a one-time reward when they
              become lasting customers.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/partners/apply"
                className="inline-flex rounded-xl bg-[#2436BB] px-6 py-3.5 text-base font-semibold text-white hover:bg-[#1c2a96]"
              >
                Apply to Become a Partner
              </Link>
              <Link
                href="/support/contact"
                className="inline-flex rounded-xl border border-zinc-300 bg-white px-6 py-3.5 text-base font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </section>

        <FoundingPartnerSectionTracker>
          <section className="border-b border-zinc-200 bg-[#2436BB]/5 px-6 py-14 sm:px-8">
            <div className="mx-auto max-w-3xl rounded-2xl border border-[#2436BB]/20 bg-white p-7 shadow-sm sm:p-9">
              <FoundingPartnerBadge />
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-950">
                Founding Partner Opportunity
              </h2>
              {foundingAvailable ? (
                <>
                  <p className="mt-3 text-lg leading-relaxed text-zinc-700">
                    JobProof is looking for its first {FOUNDING_PARTNER_LIMIT} approved
                    Founding Partners. Only the first {FOUNDING_PARTNER_LIMIT} approved
                    partners receive Founding Partner status.
                  </p>
                  <p className="mt-3 font-semibold text-[#2436BB]">
                    {foundingRemaining} of {FOUNDING_PARTNER_LIMIT} positions remain.
                  </p>
                  <ul className="mt-6 space-y-3 text-zinc-700">
                    <li>• ${FOUNDING_REWARD_CAD} CAD for each qualified referral</li>
                    <li>• A Founding Partner badge in the Partner Portal</li>
                    <li>• First access to selected new business-growth tools</li>
                    <li>
                      • Opportunities to provide early feedback on selected partner and
                      product improvements
                    </li>
                  </ul>
                  <p className="mt-5 text-sm text-zinc-600">
                    Feedback helps inform our work, but not every suggestion will be
                    implemented. Founding status does not provide ownership, equity,
                    exclusivity, or decision-making authority.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-lg leading-relaxed text-zinc-700">
                  Founding Partner positions have been filled. New approved partners join as
                  Standard Partners and earn ${STANDARD_REWARD_CAD} CAD for each qualified
                  referral.
                </p>
              )}
              <p className="mt-5 text-sm leading-relaxed text-zinc-600">
                A referral qualifies after the contractor has remained a paying JobProof
                subscriber for 90 consecutive days. Rewards are reviewed and paid manually,
                and there are no recurring commissions.
              </p>
              <Link
                href="/partners/apply"
                className="mt-7 inline-flex rounded-xl bg-[#2436BB] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1c2a96]"
              >
                Apply to Become a Partner
              </Link>
            </div>
          </section>
        </FoundingPartnerSectionTracker>

        <section className="border-b border-zinc-200 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-zinc-950">Who this program is for</h2>
            <p className="mt-3 text-zinc-600">
              We are looking for organizations and individuals who already work closely with
              contractors—not a public affiliate marketplace.
            </p>
            <ul className="mt-6 grid gap-2 text-zinc-800 sm:grid-cols-2">
              {[
                "Contractor influencers",
                "Trade organizations",
                "Industry associations",
                "Business coaches",
                "Accounting firms serving contractors",
                "Financing companies",
                "Insurance providers",
                "Existing JobProof contractors",
                "Strategic business partners",
              ].map((item) => (
                <li key={item} className="flex gap-2 text-sm">
                  <span className="text-[#2436BB]">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-zinc-950">Who should you refer?</h2>
            <p className="mt-3 leading-relaxed text-zinc-600">
              JobProof is best suited to independent contractors and small contracting
              businesses that prepare quotes, visit job sites, send proposals, document
              work, or manage customer approvals.
            </p>
            <ul className="mt-6 grid gap-2 text-sm text-zinc-800 sm:grid-cols-3">
              {[
                "Electricians",
                "Plumbers",
                "HVAC contractors",
                "Landscapers",
                "Roofers",
                "Painters",
                "Renovators",
                "General contractors",
                "Concrete contractors",
                "Flooring installers",
                "Deck and fence contractors",
                "Handymen",
                "Window and door installers",
              ].map((trade) => (
                <li key={trade} className="flex gap-2">
                  <span className="text-[#2436BB]">•</span>
                  <span>{trade}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-zinc-600">
              These are examples, not limits—contractors in other trades are welcome.
            </p>
            <div className="mt-7 rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="font-semibold text-zinc-950">The ideal referral</h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                <li>• Is an independent contractor or small company</li>
                <li>• Regularly prepares quotes</li>
                <li>• Wants to look more professional</li>
                <li>
                  • Needs a better way to organize customer details, photos, notes,
                  approvals, and proposals
                </li>
                <li>• Is willing to use a digital tool to improve the business</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-200 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-zinc-950">Why become a JobProof Partner</h2>
            <ul className="mt-6 space-y-3 text-zinc-700">
              {[
                "Help contractors grow their business with better tools",
                "Recommend software you believe in",
                "Earn straightforward referral rewards",
                "No ongoing account management required",
                "No recurring commissions to track",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2436BB]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-zinc-950">How it works</h2>
            <ol className="mt-8 space-y-4">
              {[
                "Apply",
                "Get approved",
                "Share your referral link",
                "Contractor starts a free trial",
                "Contractor subscribes",
                "Contractor remains a paying subscriber for 90 consecutive days",
                "Reward is reviewed, approved, and paid manually",
              ].map((step, i) => (
                <li key={step} className="flex gap-4 text-zinc-800">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2436BB] text-sm font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-1 font-medium">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b border-zinc-200 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-zinc-950">Referral rewards</h2>
            <p className="mt-3 text-zinc-600">
              Referral rewards qualify after the referred contractor has remained a paying
              JobProof subscriber for 90 consecutive days. One referral equals one one-time
              reward—no recurring or percentage commissions. Referral quality matters more
              than signup volume.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border-2 border-[#2436BB] bg-[#2436BB]/5 p-6">
                <p className="text-sm font-semibold uppercase tracking-wide text-[#2436BB]">
                  Founding Partner
                </p>
                <p className="mt-2 text-3xl font-bold text-zinc-950">
                  ${FOUNDING_REWARD_CAD} CAD
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  {foundingAvailable
                    ? `Per qualified referral. ${foundingRemaining} of ${FOUNDING_PARTNER_LIMIT} founding positions remain.`
                    : "Founding Partner positions have been filled."}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Standard Partner
                </p>
                <p className="mt-2 text-3xl font-bold text-zinc-950">
                  ${STANDARD_REWARD_CAD} CAD
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  Per qualified referral for all partners after the first {FOUNDING_PARTNER_LIMIT}.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-200 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-zinc-950">FAQ</h2>
            <dl className="mt-8 space-y-6">
              {PARTNER_LANDING_FAQS.map((faq) => (
                <div key={faq.question}>
                  <dt className="font-semibold text-zinc-900">{faq.question}</dt>
                  <dd className="mt-1 text-zinc-600">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="px-6 py-16 sm:px-8">
          <div className="mx-auto max-w-3xl rounded-2xl bg-zinc-950 px-8 py-12 text-center text-white">
            <h2 className="text-2xl font-bold">Ready to partner with JobProof?</h2>
            <p className="mt-3 text-zinc-300">
              Applications are reviewed individually. We approve partners who can introduce quality
              contractors.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/partners/apply"
                className="inline-flex rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-zinc-950 hover:bg-zinc-100"
              >
                Apply to Become a Partner
              </Link>
              <Link
                href="/support/contact"
                className="inline-flex rounded-xl border border-zinc-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-zinc-900"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 px-6 py-8 text-center text-sm text-zinc-500">
        <div className="flex flex-wrap justify-center gap-5">
          <Link href="/" className="hover:text-zinc-800">
            ← Back to JobProof
          </Link>
          <Link href="/partners/agreement" className="hover:text-zinc-800">
            Partner Program Agreement
          </Link>
        </div>
      </footer>
    </div>
  );
}
