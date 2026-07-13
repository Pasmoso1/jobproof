import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";

export const metadata = {
  title: "Terms of Service — JobProof",
  description: "Terms governing use of the JobProof contractor platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-200 px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/">
            <JobProofLogo />
          </Link>
          <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 sm:px-8 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950">Terms of Service</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: July 13, 2026</p>
        <div className="mt-8 space-y-8 text-base leading-relaxed text-zinc-700">
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Agreement</h2>
            <p className="mt-2">
              By creating an account or using JobProof, you agree to these Terms of Service. If you
              are using JobProof for a business, you represent that you have authority to bind that
              business to these terms.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">The service</h2>
            <p className="mt-2">
              JobProof is a software platform that helps contractors manage quote requests,
              proposals, jobs, documentation, and related workflows. Features may change over time as
              we improve the product.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Acceptable use</h2>
            <p className="mt-2">You agree not to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Use JobProof for unlawful, fraudulent, or abusive purposes</li>
              <li>Attempt to disrupt, reverse engineer, or gain unauthorized access to the service</li>
              <li>Upload content you do not have the right to use</li>
              <li>Misrepresent your identity or your business in a way that harms others</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Contractor responsibilities</h2>
            <p className="mt-2">
              You are responsible for the accuracy of information you enter, including quotes,
              contracts, invoices, and customer records. You remain responsible for your legal and
              tax obligations to your customers and to tax authorities. JobProof does not provide
              legal, accounting, or tax advice.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Free trial</h2>
            <p className="mt-2">
              New accounts may receive a free trial as described in the product. Trial length and
              plan features are set by JobProof. Trials may convert to read-only mode when they end
              until you subscribe. No payment is required to start a trial unless stated otherwise at
              signup.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Subscription billing</h2>
            <p className="mt-2">
              Paid plans are billed in Canadian dollars according to the plan you select. Payments
              are processed by Stripe. Prices shown on the website apply unless we communicate a
              change for your plan. Applicable taxes may apply based on your location and our tax
              obligations.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Cancellation</h2>
            <p className="mt-2">
              You may cancel a paid subscription through Billing settings or the Stripe customer
              portal where available. Cancellation typically takes effect at the end of the current
              billing period unless otherwise stated. After cancellation or trial expiry, access may
              become limited (for example, read-only) while existing data remains available according
              to our retention practices.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Intellectual property</h2>
            <p className="mt-2">
              JobProof and its branding, software, and documentation are owned by JobProof. You
              retain ownership of the content and business records you upload. You grant us a limited
              licence to host and process that content solely to provide the service.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Availability</h2>
            <p className="mt-2">
              We aim to keep JobProof reliable, but we do not guarantee uninterrupted or
              error-free operation. Planned maintenance or unexpected outages may occur.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Limitation of liability</h2>
            <p className="mt-2">
              To the fullest extent permitted by applicable law, JobProof is not liable for indirect,
              incidental, special, consequential, or punitive damages, or for lost profits, lost
              data, or business interruption arising from your use of the service. Our total
              liability for any claim relating to the service is limited to the fees you paid to
              JobProof for the service in the twelve months before the claim.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Changes to the service or terms</h2>
            <p className="mt-2">
              We may update JobProof features and these terms from time to time. Material changes to
              these terms will be communicated by reasonable means (for example, email or an in-app
              notice). Continued use after changes take effect constitutes acceptance of the updated
              terms.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Governing law</h2>
            <p className="mt-2">
              These terms are governed by the laws of Canada and the applicable laws of the province
              or territory in which you reside or operate, without regard to conflict-of-law rules.
              Courts in Canada have exclusive jurisdiction over disputes arising from these terms,
              subject to mandatory consumer protections that cannot be waived.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Contact</h2>
            <p className="mt-2">
              Questions about these terms:{" "}
              <a href="mailto:jeffrey@jobproof.ca" className="font-medium text-[#2436BB] hover:underline">
                jeffrey@jobproof.ca
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
