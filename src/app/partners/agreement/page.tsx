import type { Metadata } from "next";
import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";
import { PartnerAgreementViewTracker } from "@/components/partners/partner-public-analytics";
import {
  FOUNDING_REWARD_CAD,
  PARTNER_AGREEMENT_VERSION,
  STANDARD_REWARD_CAD,
} from "@/lib/partners/constants";

export const metadata: Metadata = {
  title: "Partner Program Agreement — JobProof",
  description: "Terms for participating in the JobProof Partner Program.",
};

export default function PartnerAgreementPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <PartnerAgreementViewTracker />
      <header className="border-b border-zinc-200 px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/">
            <JobProofLogo />
          </Link>
          <Link
            href="/partners"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Partner Program
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 sm:px-8 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
          Partner Program Agreement
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Version {PARTNER_AGREEMENT_VERSION}
        </p>
        <p className="mt-5 leading-relaxed text-zinc-700">
          This agreement explains the rules for participating in the JobProof Partner
          Program. By applying and accepting it, you agree to follow these rules if
          JobProof approves your application. This agreement is not legal or tax advice.
        </p>

        <div className="mt-10 space-y-8 text-base leading-relaxed text-zinc-700">
          <Section title="1. Accurate representation">
            <p>
              Describe JobProof accurately and in good faith. Do not make false,
              misleading, exaggerated, or unapproved claims about features, outcomes,
              pricing, savings, legal protection, or referral rewards. Do not promise that
              JobProof will implement product or partner feedback.
            </p>
          </Section>

          <Section title="2. Responsible promotion">
            <p>
              Do not use spam, deceptive advertising, impersonation, unlawful promotion,
              misleading redirects, or tactics that could damage JobProof or contractors.
              Do not bid on JobProof trademarks in paid search, register confusing domains
              or accounts, or present yourself as JobProof without written permission.
            </p>
          </Section>

          <Section title="3. Referrals and attribution">
            <p>
              A referral is normally attributed through your unique referral link or code.
              Once a contractor is validly attributed, that attribution remains attached.
              JobProof records are used to resolve attribution questions. Self-referrals
              require explicit written approval. Duplicate, fraudulent, fabricated, or
              manipulated referrals are not eligible.
            </p>
          </Section>

          <Section title="4. Qualification and reward amounts">
            <p>
              A referral qualifies only after the referred contractor becomes a paying
              JobProof subscriber and remains a paying subscriber for 90 consecutive days.
              Founding Partners earn ${FOUNDING_REWARD_CAD} CAD per qualified referral.
              Standard Partners earn ${STANDARD_REWARD_CAD} CAD per qualified referral.
              One qualified referral earns one one-time reward. There are no recurring,
              percentage, lifetime, or multi-level commissions.
            </p>
          </Section>

          <Section title="5. Review, approval, and payment">
            <p>
              Referral and reward records are reviewed by JobProof. A reward is not payable
              until it is qualified and manually approved. Payment timing may depend on
              verification and the payment information you provide. You are responsible for
              keeping your payment email and other requested payment information accurate.
              JobProof will not mark a reward paid until payment is recorded.
            </p>
          </Section>

          <Section title="6. Taxes on partner earnings">
            <p>
              You are responsible for reporting partner earnings and paying any income,
              sales, or other taxes that apply to you. JobProof may request information or
              issue documents when required by law.
            </p>
          </Section>

          <Section title="7. Suspension or termination">
            <p>
              JobProof may suspend or end participation for breach of this agreement,
              suspected fraud, harm to JobProof or contractors, inactivity, legal or
              operational risk, or changes to the program. Suspension does not
              automatically remove legacy records. Pending referrals may be reviewed,
              cancelled, or forfeited if they are invalid, fraudulent, or not yet qualified.
              Valid rewards already approved before termination may still be paid after
              review, unless prohibited by law or connected to a breach or fraud.
            </p>
          </Section>

          <Section title="8. Confidential and unreleased information">
            <p>
              If JobProof shares non-public product plans, partner materials, business
              information, or unreleased features with you, keep them confidential and use
              them only for the intended partner purpose. Early access does not grant
              ownership, equity, exclusivity, or decision-making authority.
            </p>
          </Section>

          <Section title="9. Intellectual property and materials">
            <p>
              JobProof owns its names, logos, software, and approved marketing materials.
              You receive a limited, revocable permission to use approved materials solely
              to promote JobProof under this program. Do not alter them in a misleading way
              or imply sponsorship beyond your approved partner relationship.
            </p>
          </Section>

          <Section title="10. Program changes">
            <p>
              JobProof may change program features, reward terms, eligibility rules, or this
              agreement. Material changes will be communicated by reasonable means.
              Architecture supports recording a new agreement version if acceptance is
              requested later. Changes do not retroactively rewrite completed payouts.
            </p>
          </Section>

          <Section title="11. Availability and limitation of liability">
            <p>
              JobProof does not guarantee uninterrupted portal availability, any number of
              referrals, approval of an application or reward, or specific business results.
              To the extent permitted by law, JobProof is not liable for indirect,
              incidental, special, or consequential losses relating to the partner program.
              JobProof&apos;s total liability relating to the program will not exceed rewards
              actually paid to you in the twelve months before the event giving rise to the
              claim.
            </p>
          </Section>

          <Section title="12. Governing law">
            <p>
              This agreement is governed by the laws of Ontario and the federal laws of
              Canada that apply there, without regard to conflict-of-law rules. Courts
              located in Ontario have jurisdiction, subject to any mandatory law that
              cannot be excluded.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              Questions about this agreement can be sent to{" "}
              <a
                href="mailto:jeffrey@jobproof.ca"
                className="font-medium text-[#2436BB] hover:underline"
              >
                jeffrey@jobproof.ca
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-zinc-950">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
