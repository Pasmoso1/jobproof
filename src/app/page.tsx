import type { Metadata } from "next";
import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";
import {
  ContractorAcquisitionCtaLink,
  ContractorLandingViewTracker,
  ContractorSectionCtaLink,
  SampleQuoteCtaLink,
} from "@/components/contractor-funnel-trackers";
import { LandingIcon, type LandingIconName } from "@/components/landing/landing-icon";
import {
  ApprovalPreview,
  BriefPreview,
  PreviewFigure,
  ProposalPreview,
  RequestPreview,
} from "@/components/landing/product-previews";
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
  title: "JobProof | Quote Request & Job Management Software for Canadian Contractors",
  description:
    "Let customers send job details and photos before you call back. Quote requests, professional quotes and job management for Canadian contractors. Free for 14 days.",
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
    before: "Calls and texts interrupt the workday.",
    after: "Send one quote-request link.",
  },
  {
    before: "Basic job details are collected by hand.",
    after: "The customer provides the job details.",
  },
  {
    before: "Photos arrive in separate messages.",
    after: "Photos stay with the request.",
  },
  {
    before: "Missing details mean more back-and-forth.",
    after: "Follow-up answers stay organized.",
  },
  {
    before: "Some inquiries aren't worth pursuing.",
    after: "Review the opportunity before you call or visit.",
  },
  {
    before: "Good leads get forgotten or answered late.",
    after: "See which requests still need a response.",
  },
] as const;

const WORKFLOW_STEPS: Array<{ icon: LandingIconName; title: string; body: string }> = [
  {
    icon: "phone",
    title: "Customer contacts you",
    body: "A call, text, email or message about a job.",
  },
  {
    icon: "link",
    title: "Send your JobProof link",
    body: "Text, copy or share it from your dashboard, or add it to your website.",
  },
  {
    icon: "camera",
    title: "Customer adds details + photos",
    body: "They describe the job and location, add photos and can answer a few job-specific questions.",
  },
  {
    icon: "search",
    title: "Review the opportunity",
    body: "Read the request and its Project Brief, then decide your next step.",
  },
  {
    icon: "document",
    title: "Build & send the quote",
    body: "Start from what the customer already told you. You set the prices.",
  },
  {
    icon: "checkCircle",
    title: "Customer approves",
    body: "They open the quote online, ask a question, request changes or accept.",
  },
];

const BENEFITS: Array<{ icon: LandingIconName; title: string; body: string }> = [
  {
    icon: "clock",
    title: "Save time",
    body: "Customers provide the basic job information, so you don't collect it piece by piece.",
  },
  {
    icon: "search",
    title: "Know the job before you call",
    body: "Review the details and photos before deciding what happens next.",
  },
  {
    icon: "message",
    title: "Respond faster",
    body: "New requests land in one place instead of getting buried in your texts.",
  },
  {
    icon: "document",
    title: "Quote sooner",
    body: "Start the quote with the information the customer already provided.",
  },
  {
    icon: "filter",
    title: "Focus on the right opportunities",
    body: "Review the scope, location and photos before committing to a call or site visit.",
  },
  {
    icon: "trophy",
    title: "Win more work",
    body: "Respond professionally, quote sooner and see which quotes are still waiting.",
  },
];

const AFTER_WIN_CARDS: Array<{ icon: LandingIconName; title: string; body: string }> = [
  {
    icon: "pen",
    title: "Digital contracts",
    body: "Customers read and sign on their phone or computer. Saved with the job.",
  },
  {
    icon: "swap",
    title: "Customer-approved change orders",
    body: "The customer approves the change before the extra work starts.",
  },
  {
    icon: "receipt",
    title: "Invoices and reminders",
    body: "Invoices customers view online, with payment reminders you can automate.",
  },
  {
    icon: "camera",
    title: "Site visit records",
    body: "Notes, photos and voice notes from the visit stay with the job.",
  },
  {
    icon: "message",
    title: "Customer questions and approvals",
    body: "Questions, change requests and approvals stay with the quote and the job.",
  },
  {
    icon: "folder",
    title: "One organized job history",
    body: "Photos, paperwork and key steps in one place when you need them.",
  },
];

const primaryCtaClassName =
  "inline-flex w-full items-center justify-center rounded-xl bg-[#2436BB] px-8 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto";

const secondaryCtaClassName =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-6 py-3.5 text-base font-semibold text-[#2436BB] transition-colors hover:bg-[#2436BB]/5 focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto";

const outlineCtaClassName =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#2436BB]/30 bg-white px-6 py-3.5 text-base font-semibold text-[#2436BB] transition-colors hover:bg-[#2436BB]/5 focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto";

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
      <h2 className="mt-3 text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-zinc-950 sm:text-4xl">
        {title}
      </h2>
      {lead ? (
        <p className="mt-4 text-base leading-relaxed text-zinc-600 sm:text-xl">{lead}</p>
      ) : null}
    </div>
  );
}

/** Side-by-side example screens on larger screens; a swipeable row on phones to keep the page short. */
function PreviewRow({ label, children }: { label: string; children: React.ReactNode[] }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] sm:mx-auto sm:grid sm:max-w-4xl sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0"
    >
      {children.map((child, index) => (
        <div key={index} className="w-[85%] shrink-0 snap-center sm:w-auto">
          {child}
        </div>
      ))}
    </div>
  );
}

function IconCard({
  icon,
  title,
  body,
}: {
  icon: LandingIconName;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2436BB]/10 text-[#2436BB]">
        <LandingIcon name={icon} />
      </span>
      <div>
        <h3 className="font-semibold text-zinc-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-zinc-600">{body}</p>
      </div>
    </li>
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
        {/* 1. Hero: save time by collecting job details upfront */}
        <section className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-white px-6 py-8 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[#2436BB] sm:tracking-[0.16em]">
              Built for Canadian contractors
            </p>
            <h1 className="mt-3 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-zinc-950 sm:mt-4 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
              Spend less time chasing quote details.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-balance text-lg font-semibold leading-snug text-zinc-800 sm:mt-5 sm:text-2xl">
              Let customers tell you what they need before you call them back.
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-zinc-600 sm:mt-4 sm:text-lg">
              Send customers your JobProof quote-request link or add it to your website. They
              provide the job details, photos and answers you need—so you can review the
              opportunity before you call, visit or quote.
            </p>
            <p className="mt-4 text-balance text-base font-semibold text-[#2436BB] sm:text-lg">
              Respond faster. Quote sooner. Win more jobs.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:mt-8 sm:flex-row sm:justify-center sm:gap-4">
              <ContractorAcquisitionCtaLink
                href="/signup"
                ctaText="Start Your 14-Day Free Trial"
                ctaLocation="hero"
                className={primaryCtaClassName}
              >
                Start Your 14-Day Free Trial
              </ContractorAcquisitionCtaLink>
              <p className="text-sm leading-relaxed text-zinc-500 sm:hidden">{TRIAL_NOTE}</p>
              <ContractorSectionCtaLink
                href="#how-it-works"
                ctaText="See How It Works"
                ctaLocation="hero"
                className={secondaryCtaClassName}
              >
                See How It Works <span aria-hidden>↓</span>
              </ContractorSectionCtaLink>
            </div>
            <p className="mt-3 hidden text-sm leading-relaxed text-zinc-500 sm:block">
              {TRIAL_NOTE}
            </p>
            <ul
              aria-label="The JobProof promise"
              className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-zinc-800 sm:mt-8 sm:text-base"
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

        {/* 2. The problem: busy contractors chasing information */}
        <section className="border-b border-zinc-200 px-6 py-10 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-4xl">
            <SectionHeading
              eyebrow="Sound familiar?"
              title="You're busy doing the work. JobProof helps handle the questions."
              lead="A customer calls while you're on a job. Another sends a text. Someone else sends photos later. By the time you're ready to quote, the information is scattered—or you're still waiting for it."
            />
            <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:mt-12">
              <div className="grid grid-cols-2 border-b border-zinc-200 bg-zinc-50">
                <h3 className="border-r border-zinc-200 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 sm:px-6 sm:text-base sm:normal-case sm:tracking-normal">
                  Before JobProof
                </h3>
                <h3 className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-[#2436BB] sm:px-6 sm:text-base sm:normal-case sm:tracking-normal">
                  With JobProof
                </h3>
              </div>
              <ul className="divide-y divide-zinc-100">
                {BEFORE_AFTER.map((row) => (
                  <li key={row.before} className="grid grid-cols-2">
                    <p className="border-r border-zinc-100 px-4 py-3 text-sm leading-6 text-zinc-600 sm:px-6 sm:py-4 sm:text-[15px]">
                      {row.before}
                    </p>
                    <p className="px-4 py-3 text-sm leading-6 font-medium text-zinc-900 sm:px-6 sm:py-4 sm:text-[15px]">
                      {row.after}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#2436BB] px-5 py-4 text-center text-base font-semibold text-white sm:text-lg">
              <LandingIcon name="link" className="h-5 w-5 shrink-0" />
              Send one link. Let the customer provide the details.
            </p>
          </div>
        </section>

        {/* 3. The workflow: one link → details → review → quote → approval */}
        <section
          id="how-it-works"
          className="scroll-mt-4 border-b border-zinc-200 bg-zinc-50/60 px-6 py-10 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="How it works"
              title="Know the job before you call the customer."
              lead="Instead of spending the first conversation collecting basic information, review what the customer needs first—then call knowing what questions still matter."
            />
            <ol className="mt-8 grid gap-3 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
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

            <h3 className="mt-12 text-center text-lg font-semibold text-zinc-950 sm:text-xl">
              What you see before you call
            </h3>
            <div className="mt-6">
              <PreviewRow label="What you see before you call">
                <PreviewFigure
                  icon="inbox"
                  title="The customer's request"
                  caption="What they need, where the job is, their photos and their answers to follow-up questions, all in one request."
                >
                  <RequestPreview />
                </PreviewFigure>
                <PreviewFigure
                  icon="clipboard"
                  title="Project Brief and checklist"
                  caption="JobProof summarizes the request, lists what to verify and builds a Quote Preparation Checklist."
                >
                  <BriefPreview />
                </PreviewFigure>
              </PreviewRow>
            </div>
          </div>
        </section>

        {/* 4. Business benefits */}
        <section className="border-b border-zinc-200 px-6 py-10 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Why it helps"
              title="Less chasing. Faster quotes. More work won."
              lead="When customers send the details upfront, you know which opportunities are worth your time—and you can respond while the job is still fresh."
            />
            <ul className="mt-8 grid gap-3 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map((item) => (
                <IconCard key={item.title} {...item} />
              ))}
            </ul>
          </div>
        </section>

        {/* 5. Professional quote and the customer's experience */}
        <section className="border-b border-zinc-200 bg-zinc-50/60 px-6 py-10 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-4xl">
            <SectionHeading
              eyebrow="Professional quotes"
              title="You already have the information. Now turn it into a professional quote."
              lead="Quote Builder starts a draft from the customer's request, the Project Brief and your site visit notes. You review it, set your prices and send it."
            />
            <div className="mt-8 sm:mt-12">
              <PreviewRow label="Example quote and customer approval screens">
                <PreviewFigure
                  icon="document"
                  title="Your quote"
                  caption="A clear proposal with scope, pricing and terms that customers open on their phone or computer."
                >
                  <ProposalPreview />
                </PreviewFigure>
                <PreviewFigure
                  icon="checkCircle"
                  title="Customer approval"
                  caption="Customers can ask a question, request changes or accept online, and you're notified when they accept."
                >
                  <ApprovalPreview />
                </PreviewFigure>
              </PreviewRow>
            </div>
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
                className={`mt-5 ${outlineCtaClassName}`}
              >
                See a Sample Quote <span aria-hidden>→</span>
              </SampleQuoteCtaLink>
            </div>
          </div>
        </section>

        {/* 6. After you win: get paid, stay protected */}
        <section className="border-b border-zinc-200 px-6 py-10 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="After you win the job"
              title="Get paid and stay protected."
              lead="Winning the job is only the beginning. JobProof keeps the work organized from contract to final invoice, so you have a clear record of what was agreed, changed and approved."
            />
            <ul className="mt-8 grid gap-3 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
              {AFTER_WIN_CARDS.map((item) => (
                <IconCard key={item.title} {...item} />
              ))}
            </ul>
            <p className="mx-auto mt-8 max-w-2xl text-center text-base leading-relaxed text-zinc-600 sm:mt-10">
              If questions or disputes come up later, you already have a clear record of what was
              requested, approved and documented, without digging through old messages.
            </p>
          </div>
        </section>

        {/* 7. Pricing */}
        <section id="pricing" className="border-b border-zinc-200 bg-zinc-50/60 px-6 py-10 sm:px-8 sm:py-20">
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
                    Everything you need to collect job details upfront, send professional quotes
                    and keep every job organized.
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
                    Everything in Solo, plus unlimited active jobs, more storage and multiple
                    trades as you take on more work.
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
        <section className="bg-zinc-950 px-6 py-14 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-400 sm:text-sm sm:tracking-[0.14em]">
              Win More Jobs. Get Paid. Stay Protected.
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              Spend less time chasing quote details. Spend more time on the work.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-300">
              Let customers send the details upfront, respond while the job is fresh, send a
              professional quote and turn more requests into paying jobs.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <ContractorAcquisitionCtaLink
                href="/signup"
                ctaText="Start Your 14-Day Free Trial"
                ctaLocation="final_cta"
                className="inline-flex w-full items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-zinc-950 transition-colors hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-950 sm:w-auto"
              >
                Start Your 14-Day Free Trial
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
            <p className="mx-auto mt-4 text-base text-zinc-400">{TRIAL_NOTE}</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-white px-6 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-zinc-500">© {new Date().getFullYear()} JobProof</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <a href="#how-it-works" className="font-medium text-zinc-600 hover:text-zinc-900">
              How it works
            </a>
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
