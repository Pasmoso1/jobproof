import type { Metadata } from "next";
import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";
import { getPlanDisplayLines } from "@/lib/billing-plan-display";
import {
  formatActiveJobLimit,
  formatPlanStorage,
  formatPlanTrades,
} from "@/lib/plan-limits";
import {
  formatStorageAllowance,
  PLAN_ENTITLEMENTS,
} from "@/lib/plan-entitlements";

export const metadata: Metadata = {
  title: "JobProof — From first inquiry to signed quote",
  description:
    "JobProof helps contractors go from the first quote request to a signed proposal—organized, professional, and all in one place.",
};

const SOLO_PRICING = getPlanDisplayLines("essential", "standard");
const PRO_PRICING = getPlanDisplayLines("professional", "standard");

const SOLO_FEATURES = [
  "Customer quote requests",
  "Smart follow-up questions",
  "Project Brief",
  "Quote Preparation Checklist",
  "Site Visit Notes",
  "Quote Builder",
  "Professional customer proposals",
  "Customer records",
  "Secure document storage",
] as const;

const PRO_FEATURES = [
  "Unlimited active jobs",
  `${formatStorageAllowance(PLAN_ENTITLEMENTS.professional)} secure document storage`,
  "Support for multiple contractor trades",
  "Priority support",
  "First access to new business growth tools",
  "All future Pro business features included",
] as const;

const COMPARISON_ROWS: Array<{
  feature: string;
  solo: string;
  pro: string;
}> = [
  { feature: "Customer Quote Requests", solo: "✓", pro: "✓" },
  { feature: "Smart Follow-up Questions", solo: "✓", pro: "✓" },
  { feature: "Project Brief", solo: "✓", pro: "✓" },
  { feature: "Quote Preparation Checklist", solo: "✓", pro: "✓" },
  { feature: "Site Visit Notes", solo: "✓", pro: "✓" },
  { feature: "Quote Builder", solo: "✓", pro: "✓" },
  { feature: "Customer Records", solo: "✓", pro: "✓" },
  { feature: "Professional Proposals", solo: "✓", pro: "✓" },
  {
    feature: "Active Jobs",
    solo: formatActiveJobLimit("essential"),
    pro: formatActiveJobLimit("professional"),
  },
  {
    feature: "Secure Storage",
    solo: formatPlanStorage("essential"),
    pro: formatPlanStorage("professional"),
  },
  { feature: "Multiple Contractor Trades", solo: formatPlanTrades("essential"), pro: formatPlanTrades("professional") },
  { feature: "Priority Support", solo: "—", pro: "✓" },
  {
    feature: "First Access to New Business Growth Tools",
    solo: "—",
    pro: "✓",
  },
  { feature: "Future Pro Business Features", solo: "—", pro: "✓" },
];

function TrialCta({
  centered = false,
  label = "Start Your 14-Day Free Trial",
}: {
  centered?: boolean;
  label?: string;
}) {
  return (
    <div className={centered ? "flex flex-col items-center" : undefined}>
      <Link
        href="/signup"
        className="inline-flex w-full items-center justify-center rounded-xl bg-[#2436BB] px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto"
      >
        {label}
      </Link>
      <p className={`mt-3 max-w-sm text-sm leading-relaxed text-zinc-500 ${centered ? "text-center" : ""}`}>
        No credit card required. Cancel anytime during your trial.
      </p>
    </div>
  );
}

function PlanFeatureList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-6 space-y-2.5 text-sm text-zinc-600">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 leading-snug">
          <span className="mt-0.5 shrink-0 font-bold text-[#2436BB]" aria-hidden>
            •
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#2436BB]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
        {title}
      </h2>
      {lead ? (
        <p className="mt-4 text-lg leading-relaxed text-zinc-600 sm:text-xl">{lead}</p>
      ) : null}
    </div>
  );
}

const WHY_OUTCOMES = [
  {
    title: "Win more jobs",
    body: "When every lead is written down and followed up, fewer good jobs fall through the cracks.",
  },
  {
    title: "Save hours every week",
    body: "Stop hunting for details across texts, emails, and camera rolls. Photos, notes, and customer answers stay with the quote.",
  },
  {
    title: "Look more professional",
    body: "Send clear proposals that make customers feel confident they hired the right contractor.",
  },
  {
    title: "Keep every quote organized",
    body: "One place for each customer—from the first quote request to the yes—instead of notes and apps everywhere.",
  },
  {
    title: "Never lose important information",
    body: "Photos, site visit notes, and customer answers stay with the job, not lost on your phone.",
  },
  {
    title: "Keep jobs moving",
    body: "See where each quote stands so nothing sits between the site visit and the signed yes.",
  },
] as const;

const WORKFLOW_STEPS = [
  {
    title: "Customer requests a quote",
    body: "A new request comes in with the basics—who they are, what they need, and where the work is.",
  },
  {
    title: "Collect the right information",
    body: "Follow-up questions and customer photos help you understand the job before you show up.",
  },
  {
    title: "Prepare for the site visit",
    body: "Walk in knowing what to look for, what to measure, and what still needs checking.",
  },
  {
    title: "Build a professional quote",
    body: "Turn your site notes and job details into a clear proposal you can review before you send it.",
  },
  {
    title: "Send a proposal customers can review online",
    body: "Customers get a clean quote they can open on any phone or computer—no PDF lost in email.",
  },
  {
    title: "Customer signs",
    body: "They can accept online when they're ready, so you're not waiting on a callback to know where you stand.",
  },
  {
    title: "Ready to start the job",
    body: "Once they accept, you can move ahead with a clear record of what was agreed.",
  },
] as const;

const ORGANIZED_ITEMS = [
  {
    title: "Customer information",
    body: "Names, phone numbers, and addresses in one place—not copied between apps.",
  },
  {
    title: "Photos",
    body: "Customer photos and your site photos stay with the quote request.",
  },
  {
    title: "Site visit notes",
    body: "Write down what you saw on site while it's still fresh.",
  },
  {
    title: "Voice notes",
    body: "Talk through what you notice during the walk-through instead of trying to remember later.",
  },
  {
    title: "Quote preparation",
    body: "Put the proposal together and tidy it up before it goes out.",
  },
  {
    title: "Professional proposals",
    body: "Show what's included, the price, and the terms in a way customers can actually follow.",
  },
  {
    title: "Customer questions and approvals",
    body: "Questions, change requests, and the final yes—all tied to the same quote.",
  },
  {
    title: "Project history",
    body: "A clear record of what happened and when, from the first quote request onward.",
  },
] as const;

const PROTECTION_CARDS = [
  {
    title: "Customer-approved change orders",
    body: "When the work changes, send a clear change order the customer can review and approve before any extra work starts—so you're both on the same page.",
  },
  {
    title: "Digital contracts",
    body: "Contracts can be read and signed on a phone or computer, then stay with the job so you always know what was agreed.",
  },
  {
    title: "All your job details in one place",
    body: "Keep photos, notes, approvals, and key job details together in one place—easy to find when you need them later.",
  },
  {
    title: "Site visit records",
    body: "Take notes, photos, and voice recordings during the visit so important details don't get lost on the drive home.",
  },
  {
    title: "Customer questions and approvals",
    body: "Keep customer questions, change requests, and approvals with the job—where you can find them when you need them.",
  },
  {
    title: "Organized project timeline",
    body: "Every key step—from the first quote request through the signed quote—stays in one place so you can see how the job moved forward.",
  },
] as const;

const SWITCH_COMPARISON = [
  {
    before: "Customer details buried in text threads and half-finished notes.",
    after: "One customer record for every inquiry and quote.",
  },
  {
    before: "Scratch paper and memory after a site visit.",
    after: "Clear site visit notes, photos, and voice recordings.",
  },
  {
    before: "Verbal \"yeah, go ahead\" with nothing to show for it.",
    after: "Change orders customers review and approve online.",
  },
  {
    before: "A basic quote emailed as a PDF—or typed into a message.",
    after: "Professional proposals customers can open, review, and accept.",
  },
  {
    before: "Scrolling through camera rolls looking for the right photo.",
    after: "Photos and files kept with the job history.",
  },
  {
    before: "Juggling notebooks, texts, email, and a few other apps.",
    after: "One place from first inquiry to signed quote.",
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/">
            <JobProofLogo />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-[#2436BB] hover:text-[#1c2a96]"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-white px-6 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2436BB]">
              Built for contractors
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
              From first inquiry to signed quote.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600 sm:text-xl">
              You know how it goes. A customer texts about a job. You reply from the truck. By the
              time you sit down to write the quote, you&apos;re digging through messages trying to
              remember what they said. The photos are somewhere in your camera roll. Details get
              lost.
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-500">
              JobProof keeps every quote request in one place—from that first inquiry to a signed
              quote—so you look more professional, stay organized, and win more of the work you
              quote.
            </p>
            <div className="mt-10">
              <TrialCta centered />
            </div>
          </div>
        </section>

        {/* Section 1 — Why contractors choose JobProof */}
        <section className="border-b border-zinc-200 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              title="Why contractors choose JobProof"
              lead="You didn't start this business to chase paperwork. JobProof helps you run quotes the way you already work—just without the mess."
            />
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {WHY_OUTCOMES.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <h3 className="text-lg font-semibold text-zinc-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 sm:text-[15px]">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 2 — How JobProof Works */}
        <section className="border-b border-zinc-200 bg-zinc-50/60 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <SectionHeading
              eyebrow="How it works"
              title="How JobProof Works"
              lead="No complicated setup. Just a clear path that matches how jobs actually start."
            />
            <ol className="mt-12 space-y-0">
              {WORKFLOW_STEPS.map((step, index) => (
                <li key={step.title}>
                  <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-5 sm:px-6">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#2436BB]">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-zinc-950">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600 sm:text-[15px]">
                      {step.body}
                    </p>
                  </div>
                  {index < WORKFLOW_STEPS.length - 1 ? (
                    <p
                      className="py-3 text-center text-2xl font-light text-zinc-300"
                      aria-hidden
                    >
                      ↓
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section className="border-b border-zinc-200 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              title="Simple, Transparent Pricing"
              lead="Pick the plan that fits your business today—and where you want it to go. Every plan includes a 14-day free trial with no credit card required."
            />

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
                <div>
                  <h3 className="text-2xl font-bold text-zinc-950">Solo</h3>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">
                    {SOLO_PRICING.afterTrialLine.replace("/mo", "")}
                    <span className="text-lg font-semibold text-zinc-500">/month</span>
                  </p>
                  <p className="mt-2 text-base font-medium text-zinc-800">
                    Perfect for independent contractors.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    Everything you need to keep quote requests organized, send professional
                    proposals, and win more work.
                  </p>
                </div>
                <PlanFeatureList items={SOLO_FEATURES} />
                <Link
                  href="/signup"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-[#2436BB] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2"
                >
                  Start Free Trial
                </Link>
              </div>

              <div className="relative flex flex-col rounded-2xl border-2 border-[#2436BB] bg-[#2436BB]/5 p-6 shadow-md sm:p-8">
                <div>
                  <p className="mb-3 inline-flex items-center rounded-full bg-[#2436BB] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    ⭐ Most Popular
                  </p>
                  <h3 className="text-2xl font-bold text-zinc-950">Pro</h3>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">
                    {PRO_PRICING.afterTrialLine.replace("/mo", "")}
                    <span className="text-lg font-semibold text-zinc-500">/month</span>
                  </p>
                  <p className="mt-2 text-base font-medium text-zinc-800">
                    Built for growing contractors.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    Everything in Solo, plus extras that help you grow your business.
                  </p>
                </div>
                <p className="mt-6 text-sm font-semibold text-zinc-800">
                  Built to help your company grow:
                </p>
                <PlanFeatureList items={PRO_FEATURES} />
                <Link
                  href="/signup"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-[#2436BB] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>

            <div className="mt-12">
              <h3 className="text-center text-lg font-semibold text-zinc-950">Compare plans</h3>
              <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-zinc-600">
                Solo keeps you organized. Pro helps you stay organized as you take on more work—and
                get early access to new tools for your business.
              </p>
              <div className="mt-6 -mx-2 overflow-x-auto px-2 sm:mx-0 sm:px-0">
                <table className="min-w-[560px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th scope="col" className="py-3 pr-4 font-semibold text-zinc-950">
                        Feature
                      </th>
                      <th scope="col" className="px-4 py-3 text-center font-semibold text-zinc-950">
                        Solo
                      </th>
                      <th scope="col" className="py-3 pl-4 text-center font-semibold text-[#2436BB]">
                        Pro
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {COMPARISON_ROWS.map((row) => (
                      <tr key={row.feature}>
                        <td className="py-3.5 pr-4 font-medium text-zinc-800">{row.feature}</td>
                        <td className="px-4 py-3.5 text-center text-zinc-600">{row.solo}</td>
                        <td className="py-3.5 pl-4 text-center font-medium text-zinc-800">
                          {row.pro}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 — Everything organized before work begins */}
        <section className="border-b border-zinc-200 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              title="Everything organized before work begins"
              lead="Most quoting problems start before the job does—missing details, forgotten photos, unclear work. JobProof keeps it together so you're not juggling five different tools."
            />
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {ORGANIZED_ITEMS.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <span
                    className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2436BB]/10 text-sm font-bold text-[#2436BB]"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <div>
                    <h3 className="font-semibold text-zinc-950">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-600 sm:text-[15px]">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-12 max-w-2xl text-center text-base leading-relaxed text-zinc-600">
              You shouldn&apos;t need a notebook, a photo album, a spreadsheet, and three apps just to
              send one quote. JobProof puts it in one place so you can focus on the work—not the
              paperwork.
            </p>
          </div>
        </section>

        {/* Section 4 — Designed for contractors */}
        <section className="border-b border-zinc-200 bg-zinc-50/60 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <SectionHeading title="Built for the way contractors actually work" />
            <div className="mt-10 space-y-5 text-base leading-relaxed text-zinc-600 sm:text-lg sm:leading-8">
              <p>
                JobProof wasn&apos;t built as generic office software with a contractor sticker on it.
                It was built around how jobs really start—the site visit, the follow-up questions,
                the details that shape the quote, and the moment they say yes.
              </p>
              <p>
                You work on your phone at the job site. You need answers fast. You don&apos;t have time
                for complicated tools that only make sense at a desk. JobProof fits how you
                actually run your business.
              </p>
              <p>
                Whether you work alone, with a small crew, or you&apos;re growing, the path is the same:
                catch the request, get ready, send a professional quote, and get to the job.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5 — Customer experience */}
        <section className="border-b border-zinc-200 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              title="A better experience for your customers"
              lead="How you send a quote says a lot about how you'll run the job. JobProof helps you look established and easy to work with."
            />
            <div className="mx-auto mt-12 max-w-3xl">
              <p className="text-center text-base leading-relaxed text-zinc-600 sm:text-lg">
                Customers get a clean, professional proposal they can open on their phone or
                computer. They can review what&apos;s included and the price, ask a question, request a
                change, or accept when they&apos;re ready—without a messy email thread or a PDF lost in
                their downloads.
              </p>
              <ul className="mt-10 grid gap-4 sm:grid-cols-2">
                {[
                  "Review the quote clearly",
                  "Ask questions",
                  "Request changes",
                  "Accept online",
                ].map((item) => (
                  <li
                    key={item}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-800 sm:text-base"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-10 text-center text-base leading-relaxed text-zinc-600">
                When customers trust what they&apos;re reading, they say yes faster—and you spend less
                time going back and forth on basics you already covered.
              </p>
            </div>
          </div>
        </section>

        {/* Stay protected — natural documentation */}
        <section className="border-b border-zinc-200 bg-zinc-50/60 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              title="Stay Protected Every Step of the Way"
              lead="As you use JobProof, you naturally build a clear record—so you and your customers stay on the same page from the first quote request through the work."
            />
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {PROTECTION_CARDS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <h3 className="text-lg font-semibold text-zinc-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 sm:text-[15px]">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-12 max-w-2xl text-center text-base leading-relaxed text-zinc-600">
              When questions come up later, you already have a clear record of what was requested,
              approved, and documented—without digging through old messages or trying to
              remember every detail.
            </p>
          </div>
        </section>

        {/* Section 6 — Stay organized when it matters */}
        <section className="border-b border-zinc-200 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <SectionHeading
              title="Stay organized when it matters"
              lead="Getting the quote out is just the start. JobProof also helps you keep a clear record as the work moves ahead."
            />
            <div className="mt-10 space-y-5 text-base leading-relaxed text-zinc-600 sm:text-lg sm:leading-8">
              <p>
                When customer approvals, photos, paperwork, change orders, and job history live in
                one place, you have what you need if questions come up later—not a scramble to
                piece together what was agreed.
              </p>
              <p>
                That&apos;s just how a solid business runs: nothing important gets lost, and you can
                move ahead with confidence.
              </p>
            </div>
            <ul className="mt-8 flex flex-wrap justify-center gap-3">
              {[
                "Customer approvals",
                "Photos",
                "Paperwork",
                "Change orders",
                "Job history",
              ].map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Why contractors switch */}
        <section className="border-b border-zinc-200 bg-zinc-50/40 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHeading
              title="Why contractors switch to JobProof"
              lead="Most contractors know the left column by heart. The right column is how quoting feels when everything lives in one place."
            />
            <div className="mt-12 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="grid grid-cols-2 border-b border-zinc-200 bg-zinc-50">
                <div className="border-r border-zinc-200 px-4 py-4 sm:px-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 sm:text-base sm:normal-case sm:tracking-normal">
                    Before JobProof
                  </h3>
                </div>
                <div className="px-4 py-4 sm:px-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[#2436BB] sm:text-base sm:normal-case sm:tracking-normal">
                    With JobProof
                  </h3>
                </div>
              </div>
              <ul className="divide-y divide-zinc-100">
                {SWITCH_COMPARISON.map((row) => (
                  <li key={row.before} className="grid grid-cols-2">
                    <p className="border-r border-zinc-100 px-4 py-4 text-sm leading-6 text-zinc-600 sm:px-6 sm:text-[15px]">
                      {row.before}
                    </p>
                    <p className="px-4 py-4 text-sm leading-6 font-medium text-zinc-900 sm:px-6 sm:text-[15px]">
                      {row.after}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-zinc-950 px-6 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              Ready to spend less time chasing details and more time winning work?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-300">
              Start your free 14-day trial today.
            </p>
            <p className="mx-auto mt-2 text-base text-zinc-400">No credit card required.</p>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-zinc-400">
              Look professional from the very first quote request.
            </p>
            <div className="mt-10 flex flex-col items-center">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-zinc-950 transition-colors hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-950 sm:w-auto"
              >
                Start Your Free Trial
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-white px-6 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-zinc-500">© {new Date().getFullYear()} JobProof</p>
          <div className="flex gap-6 text-sm">
            <Link href="/login" className="font-medium text-zinc-600 hover:text-zinc-900">
              Sign in
            </Link>
            <Link href="/signup" className="font-medium text-[#2436BB] hover:text-[#1c2a96]">
              Start free trial
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
