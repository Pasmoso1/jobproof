import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";
import { PublicEstimateToolbar } from "@/components/public-estimate-toolbar";
import {
  ContractorAcquisitionCtaLink,
  SampleQuoteViewTracker,
} from "@/components/contractor-funnel-trackers";
import {
  SAMPLE_QUOTE_CONTRACTOR,
  SAMPLE_QUOTE_META,
  SAMPLE_QUOTE_PROPOSAL,
} from "@/lib/sample-quote";
import { SampleQuoteResponse } from "./sample-quote-response";

export const metadata: Metadata = {
  title: "Sample Customer Quote | JobProof",
  description:
    "See the kind of professional quote a customer receives from a contractor using JobProof. This is a sample; the business, customer and prices are fictional.",
  robots: { index: false, follow: true },
};

function money(n: number) {
  return n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-zinc-200 pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function BulletList({ items, icon = "•" }: { items: string[]; icon?: string }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-6 text-zinc-700 sm:text-[15px]">
          <span className="mt-0.5 font-semibold text-[#2436BB]" aria-hidden>
            {icon}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const primaryCtaClassName =
  "inline-flex items-center justify-center rounded-xl bg-[#2436BB] font-semibold text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2";

export default function SampleQuotePage() {
  const c = SAMPLE_QUOTE_CONTRACTOR;
  const meta = SAMPLE_QUOTE_META;
  const proposal = SAMPLE_QUOTE_PROPOSAL;

  return (
    <div className="min-h-screen bg-zinc-50 print:bg-white">
      <SampleQuoteViewTracker />

      <header className="border-b border-zinc-200 bg-white px-4 py-3 sm:px-6 print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Link href="/" className="shrink-0">
            <JobProofLogo className="h-7 w-auto sm:h-8" />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:inline"
            >
              ← Back to JobProof
            </Link>
            <ContractorAcquisitionCtaLink
              href="/signup"
              ctaText="Create Quotes Like This"
              ctaLocation="sample_quote_header"
              className={`${primaryCtaClassName} rounded-lg px-3 py-2 text-sm sm:px-4`}
            >
              Create Quotes Like This
            </ContractorAcquisitionCtaLink>
          </div>
        </div>
      </header>

      <div
        role="note"
        className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 sm:px-6 print:hidden"
      >
        <div className="mx-auto max-w-4xl">
          <p className="text-sm leading-6">
            <span className="font-semibold">This is a sample quote.</span> It shows what your
            customers receive when you send a quote with JobProof. The business, customer and prices
            are fictional, and nothing you do on this page is sent or saved.
          </p>
          <Link
            href="/"
            className="mt-1 inline-block text-sm font-semibold text-amber-950 underline underline-offset-2 sm:hidden"
          >
            ← Back to JobProof
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:py-4">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#2436BB]">
              Project Quote
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] tracking-wide text-amber-900">
                Sample
              </span>
            </p>
            <h1 className="mt-2 text-2xl font-bold text-zinc-950 sm:text-3xl">{meta.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {meta.estimateNumberLabel} · Valid until {meta.expiryDateLabel}
            </p>
          </div>
          <PublicEstimateToolbar token="sample" hasPdf={false} />
        </header>

        <div className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8 print:border-0 print:shadow-none">
          <Section title="Contractor">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xl font-semibold text-zinc-950">{c.businessName}</p>
                <p className="mt-1 text-sm text-zinc-600">{c.contactName}</p>
              </div>
              <div className="space-y-1 text-sm text-zinc-600 sm:text-right">
                <p>{c.phone}</p>
                <p>{c.email}</p>
              </div>
            </div>
          </Section>

          <Section title="Welcome">
            <p className="max-w-3xl text-sm leading-7 text-zinc-700 sm:text-[15px]">
              {proposal.welcomeMessage}
            </p>
          </Section>

          <Section title="Project overview">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-zinc-500">Project title</p>
                <p className="mt-1 text-base font-semibold text-zinc-950">{proposal.projectTitle}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500">Date prepared</p>
                <p className="mt-1 text-base text-zinc-800">{meta.issueDateLabel}</p>
              </div>
              {proposal.projectSummary ? (
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium text-zinc-500">Summary</p>
                  <p className="mt-1 text-sm leading-7 text-zinc-700 sm:text-[15px]">
                    {proposal.projectSummary}
                  </p>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-zinc-500">Property address</p>
                <div className="mt-1 space-y-1 text-sm text-zinc-700 sm:text-[15px]">
                  {meta.propertyAddressLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Scope of work">
            <BulletList items={proposal.scopeOfWork} />
          </Section>

          <Section title="What's included">
            <BulletList items={proposal.includedWork} icon="✓" />
          </Section>

          <Section title="Optional upgrades">
            <div className="space-y-3">
              {proposal.optionalUpgrades.map((upgrade) => (
                <div key={upgrade.title} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-zinc-950">{upgrade.title}</p>
                      {upgrade.description ? (
                        <p className="mt-1 text-sm leading-6 text-zinc-600">{upgrade.description}</p>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {upgrade.additionalPrice != null
                        ? `+$${money(upgrade.additionalPrice)}`
                        : "Price available on request"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="What's not included">
            <BulletList items={proposal.exclusions} />
          </Section>

          <Section title="Pricing">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
              <dl className="space-y-3">
                {proposal.pricingItems.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-4">
                    <div>
                      <dt className="text-sm font-medium text-zinc-900 sm:text-[15px]">{item.label}</dt>
                      {item.description ? (
                        <dd className="mt-1 text-sm leading-6 text-zinc-500">{item.description}</dd>
                      ) : null}
                    </div>
                    <dd className="shrink-0 text-sm font-semibold tabular-nums text-zinc-950 sm:text-[15px]">
                      ${money(item.amount)}
                    </dd>
                  </div>
                ))}
                <div className="border-t border-zinc-200 pt-3" />
                <div className="flex justify-between gap-4 text-sm text-zinc-700 sm:text-[15px]">
                  <dt>Subtotal</dt>
                  <dd className="font-medium tabular-nums">${money(proposal.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-4 text-sm text-zinc-700 sm:text-[15px]">
                  <dt>Tax ({proposal.taxRateLabel})</dt>
                  <dd className="font-medium tabular-nums">${money(proposal.taxAmount)}</dd>
                </div>
                {proposal.depositAmount != null ? (
                  <div className="flex justify-between gap-4 text-sm text-zinc-700 sm:text-[15px]">
                    <dt>Deposit</dt>
                    <dd className="font-medium tabular-nums">${money(proposal.depositAmount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3 text-base font-semibold text-zinc-950">
                  <dt>Total</dt>
                  <dd className="tabular-nums">${money(proposal.total)}</dd>
                </div>
              </dl>
            </div>
          </Section>

          <Section title="Timeline">
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm font-medium text-zinc-500">Estimated duration</dt>
                <dd className="mt-1 text-sm text-zinc-800 sm:text-[15px]">{proposal.timeline.duration}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-zinc-500">Expected start window</dt>
                <dd className="mt-1 text-sm text-zinc-800 sm:text-[15px]">{proposal.timeline.startWindow}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-zinc-500">Estimated completion</dt>
                <dd className="mt-1 text-sm text-zinc-800 sm:text-[15px]">{proposal.timeline.completion}</dd>
              </div>
            </dl>
          </Section>

          {proposal.warranty ? (
            <Section title="Warranty">
              <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-700 sm:text-[15px]">
                {proposal.warranty}
              </p>
            </Section>
          ) : null}

          <SampleQuoteResponse
            businessName={c.businessName}
            questionsOrChangesIntro={proposal.questionsOrChangesIntro}
            nextSteps={proposal.nextSteps}
          />
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500 print:hidden">
          Sample quote prepared with JobProof
        </p>

        <section className="mt-10 rounded-3xl bg-zinc-950 px-6 py-10 text-center sm:px-10 print:hidden">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Send quotes like this to your customers.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-zinc-300">
            JobProof builds a professional, easy-to-review quote from your job details, so
            customers can see exactly what they&apos;re getting and accept online.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <ContractorAcquisitionCtaLink
              href="/signup"
              ctaText="Create Quotes Like This"
              ctaLocation="sample_quote_footer"
              className="inline-flex w-full items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-zinc-950 transition-colors hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-950 sm:w-auto"
            >
              Create Quotes Like This
            </ContractorAcquisitionCtaLink>
            <p className="text-sm text-zinc-400">14 days free. No credit card required.</p>
            <Link
              href="/"
              className="mt-1 rounded-md px-2 py-1 text-sm font-medium text-zinc-300 underline-offset-2 hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              ← Back to JobProof
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
