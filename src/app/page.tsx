import type { Metadata } from "next";
import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";
import {
  ContractorAcquisitionCtaLink,
  ContractorLandingViewTracker,
  SampleQuoteCtaLink,
} from "@/components/contractor-funnel-trackers";
import { LandingIcon, type LandingIconName } from "@/components/landing/landing-icon";
import { ProductJourneyPreviews } from "@/components/landing/product-previews";
import { getPublicPlanPriceLine } from "@/lib/billing-plan-display";
import {
  formatActiveJobLimit,
  formatPlanStorage,
  formatPlanTrades,
} from "@/lib/plan-limits";
import {
  formatStorageAllowance,
  PLAN_ENTITLEMENTS,
} from "@/lib/plan-entitlements";
import { SAMPLE_QUOTE_PATH } from "@/lib/sample-quote";

export const metadata: Metadata = {
  title: "JobProof | Quoting Software That Helps Canadian Contractors Win More Jobs",
  description:
    "Turn customer inquiries into professional quotes and win more of the jobs you quote. Quoting and job management for Canadian contractors. Try it free for 14 days.",
};

const SOLO_PRICE_LINE = getPublicPlanPriceLine("essential", "standard");
const PRO_PRICE_LINE = getPublicPlanPriceLine("professional", "standard");

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

const TRIAL_NOTE = "No credit card required. Cancel anytime during your trial.";

const BRAND_PROMISE: Array<{ icon: LandingIconName; label: string }> = [
  { icon: "trophy", label: "Win More Jobs." },
  { icon: "receipt", label: "Get Paid." },
  { icon: "shield", label: "Stay Protected." },
];

const BEFORE_AFTER = [
  {
    before: "Requests pile up in texts, calls and email until you find a free minute.",
    after: "Every request lands in one place with the details you need to reply.",
  },
  {
    before: "You show up to the site visit missing half the details.",
    after: "Customer photos, follow-up answers and a Project Brief before you arrive.",
  },
  {
    before: "A price typed into a text message, or a basic PDF.",
    after: "A professional proposal customers can open, review and accept online.",
  },
  {
    before: "No easy way to see which quotes are still waiting on an answer.",
    after: "See where every quote stands and who needs a follow-up.",
  },
  {
    before: "A verbal \"yeah, go ahead\" with nothing to show for it.",
    after: "Customer-approved quotes, digital contracts and change orders.",
  },
  {
    before: "Photos, notes and paperwork scattered across your phone.",
    after: "One organized record for every job, from the first message onward.",
  },
] as const;

const OUTCOMES: Array<{ icon: LandingIconName; title: string; body: string }> = [
  {
    icon: "trophy",
    title: "Win more jobs",
    body: "Give customers more reasons to choose you over the next quote.",
  },
  {
    icon: "message",
    title: "Respond more professionally",
    body: "Reply with the job details in front of you, not buried in your texts.",
  },
  {
    icon: "document",
    title: "Make quoting easier",
    body: "Your notes, photos and customer answers are already there when you build the quote.",
  },
  {
    icon: "clock",
    title: "Follow up consistently",
    body: "See which requests need a response and which quotes are still waiting.",
  },
  {
    icon: "users",
    title: "Give customers a better experience",
    body: "A quote they can open on their phone, ask about and accept online.",
  },
];

const WORKFLOW_STEPS: Array<{ icon: LandingIconName; title: string; body: string }> = [
  {
    icon: "inbox",
    title: "Customer requests a quote",
    body: "They share what they need, where the job is, and photos.",
  },
  {
    icon: "clipboard",
    title: "JobProof collects the information",
    body: "Smart follow-up questions fill in the details you'd normally chase.",
  },
  {
    icon: "home",
    title: "Prepare for the site visit",
    body: "A Project Brief and checklist show what to look at and measure.",
  },
  {
    icon: "document",
    title: "Build the quote",
    body: "Turn your site notes into a clear proposal you review before sending.",
  },
  {
    icon: "send",
    title: "Customer receives a professional proposal",
    body: "They open it on any phone or computer. No PDF lost in email.",
  },
  {
    icon: "pen",
    title: "Customer approves",
    body: "They accept online, and you can send a digital contract to sign.",
  },
  {
    icon: "checkCircle",
    title: "Start the job with a clear record",
    body: "What was agreed is saved with the job, ready when you need it.",
  },
];

const CUSTOMER_ACTIONS = [
  "Review the scope and price",
  "Ask a question",
  "Request changes",
  "Accept online",
] as const;

const AFTER_WIN_CARDS: Array<{ icon: LandingIconName; title: string; body: string }> = [
  {
    icon: "pen",
    title: "Digital contracts",
    body: "Contracts customers can read and sign on a phone or computer, saved with the job.",
  },
  {
    icon: "swap",
    title: "Customer-approved change orders",
    body: "When the work changes, the customer reviews and approves the change before extra work starts.",
  },
  {
    icon: "receipt",
    title: "Invoices and reminders",
    body: "Send invoices customers can view online, with payment reminders you can automate.",
  },
  {
    icon: "camera",
    title: "Site visit records",
    body: "Notes, photos and voice notes from the visit stay with the job, not lost on your phone.",
  },
  {
    icon: "message",
    title: "Customer questions and approvals",
    body: "Questions, change requests and approvals stay attached to the quote and the job.",
  },
  {
    icon: "folder",
    title: "One organized job history",
    body: "Photos, paperwork and key steps in one place, easy to find when you need them.",
  },
];

const primaryCtaClassName =
  "inline-flex w-full items-center justify-center rounded-xl bg-[#2436BB] px-8 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto";

const secondaryCtaClassName =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-6 py-3.5 text-base font-semibold text-[#2436BB] transition-colors hover:bg-[#2436BB]/5 focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto";

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
        <p className="mt-4 text-base leading-relaxed text-zinc-600 sm:text-xl">{lead}</p>
      ) : null}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-clip bg-white font-sans text-zinc-900">
      <ContractorLandingViewTracker />
      <header className="border-b border-zinc-200 bg-white px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/">
            <JobProofLogo />
          </Link>
          <nav className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/login"
              className="text-sm font-medium text-[#2436BB] hover:text-[#1c2a96]"
            >
              Sign in
            </Link>
            <ContractorAcquisitionCtaLink
              href="/signup"
              ctaText="Start Free Trial"
              ctaLocation="header_nav"
              className="rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1c2a96]"
            >
              Start Free Trial
            </ContractorAcquisitionCtaLink>
          </nav>
        </div>
      </header>

      <main>
        {/* 1. Hero: win more jobs */}
        <section className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-white px-6 py-10 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2436BB]">
              Built for Canadian contractors
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
              Win more of the jobs you quote.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg font-medium leading-relaxed text-zinc-800 sm:text-2xl">
              Turn customer inquiries into professional quotes—and professional quotes into paying
              jobs.
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg">
              JobProof gives you one place to capture customer requests, prepare professional
              quotes, follow up, get approval, and keep the job organized from the first message
              onward.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <ContractorAcquisitionCtaLink
                href="/signup"
                ctaText="Start Your 14-Day Free Trial"
                ctaLocation="hero"
                className={primaryCtaClassName}
              >
                Start Your 14-Day Free Trial
              </ContractorAcquisitionCtaLink>
              <p className="text-sm leading-relaxed text-zinc-500 sm:hidden">{TRIAL_NOTE}</p>
              <SampleQuoteCtaLink
                href={SAMPLE_QUOTE_PATH}
                ctaText="See a Sample Quote"
                ctaLocation="hero"
                className={secondaryCtaClassName}
              >
                See a Sample Quote <span aria-hidden>→</span>
              </SampleQuoteCtaLink>
            </div>
            <p className="mt-3 hidden text-sm leading-relaxed text-zinc-500 sm:block">
              {TRIAL_NOTE}
            </p>
            <ul
              aria-label="The JobProof promise"
              className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-zinc-800 sm:text-base"
            >
              {BRAND_PROMISE.map((item) => (
                <li key={item.label} className="flex items-center gap-1.5">
                  <LandingIcon name={item.icon} className="h-5 w-5 text-[#2436BB]" />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 2. The contractor problem: why good leads get lost */}
        <section className="border-b border-zinc-200 px-6 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionHeading
              eyebrow="Why jobs slip away"
              title="Good jobs get lost between the first message and the quote."
              lead="A customer texts about a job. You reply from the truck. By the time you sit down to write the quote, the details are buried in messages, the photos are somewhere in your camera roll, and the customer is still waiting."
            />
            <div className="mt-10 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:mt-12">
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
                {BEFORE_AFTER.map((row) => (
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

        {/* 3. Product demonstration */}
        <section
          id="see-it"
          className="border-b border-zinc-200 bg-zinc-50/60 px-6 py-14 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="See it in action"
              title="Show customers you're ready for the job."
              lead="A professional quote does more than show a price. It shows customers they're dealing with an organized, professional contractor."
            />
            <div className="mt-10 sm:mt-12">
              <ProductJourneyPreviews />
            </div>

            <div className="mt-14">
              <h3 className="text-center text-lg font-semibold text-zinc-950 sm:text-xl">
                What that means for your business
              </h3>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {OUTCOMES.map((item) => (
                  <li
                    key={item.title}
                    className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-4 lg:flex-col"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2436BB]/10 text-[#2436BB]">
                      <LandingIcon name={item.icon} />
                    </span>
                    <div>
                      <p className="font-semibold text-zinc-950">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-zinc-600">{item.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-10 flex justify-center">
              <SampleQuoteCtaLink
                href={SAMPLE_QUOTE_PATH}
                ctaText="See a Sample Quote"
                ctaLocation="product_demo"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#2436BB]/30 bg-white px-6 py-3.5 text-base font-semibold text-[#2436BB] transition-colors hover:bg-[#2436BB]/5 focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto"
              >
                See a Sample Quote <span aria-hidden>→</span>
              </SampleQuoteCtaLink>
            </div>
          </div>
        </section>

        {/* 4. How JobProof works */}
        <section className="border-b border-zinc-200 px-6 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="How it works"
              title="How JobProof Works"
              lead="Built for how you actually work: on your phone, at the job site, from the first message to the signed yes."
            />
            <ol className="mt-10 grid gap-3 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW_STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5"
                >
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2436BB]/10 text-[#2436BB]">
                    <LandingIcon name={step.icon} />
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2436BB] text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                  </span>
                  <div>
                    <h3 className="font-semibold leading-snug text-zinc-950">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5. Customer-facing experience / sample quote */}
        <section className="border-b border-zinc-200 bg-zinc-50/60 px-6 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <SectionHeading
              eyebrow="Your customer's experience"
              title="A quote your customers can say yes to."
              lead="How you send a quote says a lot about how you'll run the job. Customers get a clean proposal they can open on their phone or computer, without a messy email thread or a PDF lost in their downloads."
            />
            <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CUSTOMER_ACTIONS.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm font-medium text-zinc-800"
                >
                  <LandingIcon name="checkCircle" className="h-4 w-4 shrink-0 text-[#2436BB]" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8">
              <p className="text-lg font-semibold text-zinc-950">See exactly what your customers see.</p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-600 sm:text-base">
                Open a sample quote, try the Accept button, and see the experience from your
                customer&apos;s side. It&apos;s a demo, so nothing is sent.
              </p>
              <SampleQuoteCtaLink
                href={SAMPLE_QUOTE_PATH}
                ctaText="See a Sample Quote"
                ctaLocation="customer_experience"
                className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#2436BB]/30 bg-white px-6 py-3.5 text-base font-semibold text-[#2436BB] transition-colors hover:bg-[#2436BB]/5 focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto"
              >
                See a Sample Quote <span aria-hidden>→</span>
              </SampleQuoteCtaLink>
            </div>
          </div>
        </section>

        {/* 6. After you win: get paid, stay protected */}
        <section className="border-b border-zinc-200 px-6 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="After you win the job"
              title="Get paid and stay protected."
              lead="Winning the job is the start. JobProof keeps the work organized as it moves ahead, so you have a clear record of what was agreed, changed and approved."
            />
            <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
              {AFTER_WIN_CARDS.map((item) => (
                <div
                  key={item.title}
                  className="flex gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2436BB]/10 text-[#2436BB]">
                    <LandingIcon name={item.icon} />
                  </span>
                  <div>
                    <h3 className="font-semibold text-zinc-950 sm:text-lg">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-600 sm:text-[15px]">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-10 max-w-2xl text-center text-base leading-relaxed text-zinc-600">
              If questions or disputes come up later, you already have a clear record of what was
              requested, approved and documented, without digging through old messages.
            </p>
          </div>
        </section>

        {/* 7. Pricing */}
        <section id="pricing" className="border-b border-zinc-200 bg-zinc-50/60 px-6 py-14 sm:px-8 sm:py-20">
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
                    {SOLO_PRICE_LINE}
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
                <ContractorAcquisitionCtaLink
                  href="/signup"
                  ctaText="Start Free Trial"
                  ctaLocation="pricing_solo"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-[#2436BB] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2"
                >
                  Start Free Trial
                </ContractorAcquisitionCtaLink>
              </div>

              <div className="relative flex flex-col rounded-2xl border-2 border-[#2436BB] bg-[#2436BB]/5 p-6 shadow-md sm:p-8">
                <div>
                  <p className="mb-3 inline-flex items-center rounded-full bg-[#2436BB] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    ⭐ Recommended
                  </p>
                  <h3 className="text-2xl font-bold text-zinc-950">Pro</h3>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">
                    {PRO_PRICE_LINE}
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
                <ContractorAcquisitionCtaLink
                  href="/signup"
                  ctaText="Start Free Trial"
                  ctaLocation="pricing_pro"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-[#2436BB] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2"
                >
                  Start Free Trial
                </ContractorAcquisitionCtaLink>
              </div>
            </div>

            <details className="group mt-10 rounded-2xl border border-zinc-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-base font-semibold text-zinc-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] sm:px-6 [&::-webkit-details-marker]:hidden">
                Compare plans
                <span
                  aria-hidden
                  className="text-xl font-light text-zinc-400 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="border-t border-zinc-200 px-3 pb-4 sm:px-6">
                <p className="mx-auto mt-4 max-w-2xl px-2 text-center text-sm text-zinc-600">
                  Solo keeps you organized. Pro helps you stay organized as you take on more work—and
                  get early access to new tools for your business.
                </p>
                <table className="mt-4 w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th scope="col" className="py-3 pr-2 font-semibold text-zinc-950 sm:pr-4">
                        Feature
                      </th>
                      <th scope="col" className="px-2 py-3 text-center font-semibold text-zinc-950 sm:px-4">
                        Solo
                      </th>
                      <th scope="col" className="py-3 pl-2 text-center font-semibold text-[#2436BB] sm:pl-4">
                        Pro
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {COMPARISON_ROWS.map((row) => (
                      <tr key={row.feature}>
                        <th scope="row" className="py-3 pr-2 font-medium text-zinc-800 sm:py-3.5 sm:pr-4">
                          {row.feature}
                        </th>
                        <td className="px-2 py-3 text-center text-zinc-600 sm:px-4 sm:py-3.5">{row.solo}</td>
                        <td className="py-3 pl-2 text-center font-medium text-zinc-800 sm:py-3.5 sm:pl-4">
                          {row.pro}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </section>

        {/* 8. Final CTA */}
        <section className="bg-zinc-950 px-6 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-400 sm:text-sm sm:tracking-[0.14em]">
              Win More Jobs. Get Paid. Stay Protected.
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              Ready to win more of the work you quote?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-300">
              Try JobProof on your next few quotes and see how it fits your business before you pay
              anything.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <ContractorAcquisitionCtaLink
                href="/signup"
                ctaText="Start Your Free Trial"
                ctaLocation="final_cta"
                className="inline-flex w-full items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-zinc-950 transition-colors hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-950 sm:w-auto"
              >
                Start Your Free Trial
              </ContractorAcquisitionCtaLink>
              <SampleQuoteCtaLink
                href={SAMPLE_QUOTE_PATH}
                ctaText="See a Sample Quote"
                ctaLocation="final_cta"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-950 sm:w-auto"
              >
                See a Sample Quote <span aria-hidden>→</span>
              </SampleQuoteCtaLink>
            </div>
            <p className="mx-auto mt-4 text-base text-zinc-400">14 days free. No credit card required.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-white px-6 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-zinc-500">© {new Date().getFullYear()} JobProof</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <a href="#pricing" className="font-medium text-zinc-600 hover:text-zinc-900">
              Pricing
            </a>
            <SampleQuoteCtaLink
              href={SAMPLE_QUOTE_PATH}
              ctaText="Sample quote"
              ctaLocation="footer"
              className="font-medium text-zinc-600 hover:text-zinc-900"
            >
              Sample quote
            </SampleQuoteCtaLink>
            <Link href="/support" className="font-medium text-zinc-600 hover:text-zinc-900">
              Support
            </Link>
            <Link href="/partners" className="font-medium text-zinc-600 hover:text-zinc-900">
              Partners
            </Link>
            <Link href="/privacy" className="font-medium text-zinc-600 hover:text-zinc-900">
              Privacy Policy
            </Link>
            <Link href="/terms" className="font-medium text-zinc-600 hover:text-zinc-900">
              Terms of Service
            </Link>
            <Link href="/login" className="font-medium text-zinc-600 hover:text-zinc-900">
              Sign in
            </Link>
            <ContractorAcquisitionCtaLink
              href="/signup"
              ctaText="Start free trial"
              ctaLocation="footer"
              className="font-medium text-[#2436BB] hover:text-[#1c2a96]"
            >
              Start free trial
            </ContractorAcquisitionCtaLink>
          </div>
        </div>
      </footer>
    </div>
  );
}
