import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";

export const metadata = {
  title: "Privacy Policy — JobProof",
  description: "How JobProof collects, uses, and protects your information.",
};

export default function PrivacyPolicyPage() {
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
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950">Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: July 13, 2026</p>
        <div className="mt-8 space-y-8 text-base leading-relaxed text-zinc-700">
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Overview</h2>
            <p className="mt-2">
              JobProof (&quot;we&quot;, &quot;us&quot;) provides tools for Canadian contractors to manage quote
              requests, proposals, jobs, and related documents. This policy explains what information
              we collect, how we use it, and the choices available to you.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Information we collect</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Account information</strong> — email address, password (stored securely by our
                authentication provider), and profile details you provide.
              </li>
              <li>
                <strong>Business information</strong> — business name, phone, address, province,
                postal code, trades, and related settings.
              </li>
              <li>
                <strong>Customer and project data</strong> — information you enter about customers,
                quote requests, site visit notes, photos, voice notes, estimates, contracts, change
                orders, invoices, and similar records.
              </li>
              <li>
                <strong>Billing information</strong> — subscription status and related billing
                identifiers. Payment card details are processed by Stripe and are not stored on
                JobProof servers.
              </li>
              <li>
                <strong>Usage and technical data</strong> — approximate device or browser information,
                pages visited in the app, and similar diagnostics needed to run and improve the
                service.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">How we use information</h2>
            <p className="mt-2">We use information to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Provide and operate JobProof for your business</li>
              <li>Send service emails (for example, account verification and product notifications)</li>
              <li>Process subscriptions and related billing through Stripe</li>
              <li>Respond to support requests and improve reliability and features</li>
              <li>Maintain security and prevent abuse</li>
            </ul>
            <p className="mt-2">
              We do not sell your personal information or your customers&apos; information.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Contractor data and customer data</h2>
            <p className="mt-2">
              As a contractor, you control the customer and project records you store in JobProof. You
              are responsible for collecting and using that information lawfully in your business
              relationship with those customers. JobProof processes that data on your behalf to
              deliver the product features you use.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Cookies and analytics</h2>
            <p className="mt-2">
              We use cookies and similar technologies that are necessary to keep you signed in and to
              operate the application. We may also use privacy-conscious product analytics to
              understand how features are used so we can improve JobProof. Analytics are intended for
              product improvement, not for selling advertising profiles.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Stripe payments</h2>
            <p className="mt-2">
              Subscription payments and optional customer invoice payments are processed by Stripe.
              Stripe&apos;s handling of payment data is governed by Stripe&apos;s own privacy terms. JobProof
              receives billing status and related metadata needed to deliver your subscription.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Third-party services</h2>
            <p className="mt-2">
              We use trusted providers to host and operate the service, including authentication and
              database hosting, email delivery, and payment processing. These providers only receive
              the information needed to perform their services for JobProof.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Data security</h2>
            <p className="mt-2">
              We use industry-standard safeguards appropriate to a modern web application, including
              encrypted connections (HTTPS) and access controls. No method of transmission or storage
              is completely secure, and we cannot guarantee absolute security.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Data retention</h2>
            <p className="mt-2">
              We retain account and project data while your account remains active and as needed to
              provide the service, comply with legal obligations, resolve disputes, and enforce our
              agreements. If you close your account, you may request deletion of personal information
              subject to records we must keep for legal or billing reasons.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Your choices</h2>
            <p className="mt-2">
              You can update business profile information in Settings. You may contact us to request
              access, correction, or deletion of personal information where applicable under Canadian
              privacy law.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Contact</h2>
            <p className="mt-2">
              Privacy questions:{" "}
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
