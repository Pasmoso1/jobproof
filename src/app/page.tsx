import type { Metadata } from "next";
import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";

export const metadata: Metadata = {
  title: "JobProof — From first inquiry to signed quote",
  description:
    "JobProof helps contractors manage quoting from the first customer inquiry through a signed proposal—organized, professional, and in one place.",
};

function TrialCta({ centered = false }: { centered?: boolean }) {
  return (
    <div className={centered ? "flex flex-col items-center" : undefined}>
      <Link
        href="/signup"
        className="inline-flex w-full items-center justify-center rounded-xl bg-[#2436BB] px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 sm:w-auto"
      >
        Start Your 14-Day Free Trial
      </Link>
      <p className={`mt-3 text-sm text-zinc-500 ${centered ? "text-center" : ""}`}>
        No credit card required.
      </p>
    </div>
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
    body: "When every inquiry is captured and followed up properly, fewer good leads slip through the cracks.",
  },
  {
    title: "Save hours every week",
    body: "Stop digging through texts, emails, and camera rolls. The details you need are already where the quote lives.",
  },
  {
    title: "Look more professional",
    body: "Send clear, polished proposals that make customers confident they hired the right contractor.",
  },
  {
    title: "Keep every quote organized",
    body: "One thread for each customer—from first message through acceptance—instead of scattered notes and apps.",
  },
  {
    title: "Never lose important information",
    body: "Photos, site visit notes, and customer answers stay attached to the job, not lost on your phone.",
  },
  {
    title: "Keep projects moving",
    body: "Know what stage each quote is in so nothing stalls between the site visit and the signed yes.",
  },
] as const;

const WORKFLOW_STEPS = [
  {
    title: "Customer requests a quote",
    body: "A new inquiry comes in with the basics—who they are, what they need, and where the work is.",
  },
  {
    title: "Collect the right information",
    body: "Follow-up questions and customer photos help you understand the job before you even show up.",
  },
  {
    title: "Prepare for the site visit",
    body: "Walk in knowing what to look for, what to measure, and what still needs confirming.",
  },
  {
    title: "Build a professional quote",
    body: "Turn site notes and project details into a clear proposal you can review and adjust before sending.",
  },
  {
    title: "Send a proposal customers can review online",
    body: "Customers get a clean, easy-to-read quote they can open on any device—no PDFs lost in email.",
  },
  {
    title: "Customer signs",
    body: "They can accept online when they're ready, so you're not waiting on a callback to know where things stand.",
  },
  {
    title: "Ready to start the job",
    body: "With the quote accepted, you move forward with confidence—and a clear record of what was agreed.",
  },
] as const;

const ORGANIZED_ITEMS = [
  {
    title: "Customer information",
    body: "Names, contact details, and property info in one place—not copied between apps.",
  },
  {
    title: "Photos",
    body: "Customer uploads and your own site photos stay with the quote request.",
  },
  {
    title: "Site visit notes",
    body: "Capture what you saw on site while it's still fresh.",
  },
  {
    title: "Voice notes",
    body: "Dictate observations during the walk-through instead of trying to remember later.",
  },
  {
    title: "Quote preparation",
    body: "Build and refine the proposal before it goes out the door.",
  },
  {
    title: "Professional proposals",
    body: "Present scope, pricing, and terms in a format customers actually understand.",
  },
  {
    title: "Customer communication",
    body: "Questions, change requests, and acceptance—all tied to the same quote.",
  },
  {
    title: "Project history",
    body: "A running record of what happened and when, from first inquiry onward.",
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
              JobProof helps you manage the entire quoting process in one place—so you save time,
              stay organized, look more professional in front of customers, and win more of the work
              you quote.
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-500">
              Whether you run jobs solo or with a small crew, everything from the first message to
              the accepted proposal lives in one workflow—not scattered across notebooks, texts, and
              random folders.
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
              lead="You didn't start contracting to chase paperwork. JobProof helps you run quotes the way you already work—just without the mess."
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

        {/* Section 2 — Workflow */}
        <section className="border-b border-zinc-200 bg-zinc-50/60 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <SectionHeading
              eyebrow="How it works"
              title="One clear path from inquiry to signed quote"
              lead="No complicated setup. Just a straightforward flow that matches how jobs actually start."
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

        {/* Section 3 — Everything organized before work begins */}
        <section className="border-b border-zinc-200 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              title="Everything organized before work begins"
              lead="Most quoting problems start before the job does—missing details, forgotten photos, unclear scope. JobProof keeps it together so you're not juggling five different tools."
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
              admin.
            </p>
          </div>
        </section>

        {/* Section 4 — Designed for contractors */}
        <section className="border-b border-zinc-200 bg-zinc-50/60 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <SectionHeading title="Designed for the way contractors actually work" />
            <div className="mt-10 space-y-5 text-base leading-relaxed text-zinc-600 sm:text-lg sm:leading-8">
              <p>
                JobProof wasn&apos;t built as generic office software with a contractor label slapped on
                it. It was shaped around real quoting workflows—the site visit, the follow-up
                questions, the back-and-forth with the customer, and the moment they say yes.
              </p>
              <p>
                You work on your phone at the job site. You need answers fast. You don&apos;t have time
                for complicated tools that only make sense at a desk. JobProof fits how you
                actually run your business.
              </p>
              <p>
                Independent operators, small teams, and growing shops all use the same core flow:
                capture the inquiry, prepare properly, send a professional quote, and move on to the
                job.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5 — Customer experience */}
        <section className="border-b border-zinc-200 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              title="A better experience for your customers"
              lead="The way you present a quote says a lot about how you'll run the job. JobProof helps you look established and easy to work with."
            />
            <div className="mx-auto mt-12 max-w-3xl">
              <p className="text-center text-base leading-relaxed text-zinc-600 sm:text-lg">
                Customers receive a clean, professional proposal they can open on their phone or
                computer. They can review the scope and pricing, ask a question, request a change,
                or accept when they&apos;re ready—all without a confusing email thread or a PDF lost in
                their downloads folder.
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
                time going back and forth clarifying basics you already covered.
              </p>
            </div>
          </div>
        </section>

        {/* Section 6 — Protection */}
        <section className="border-b border-zinc-200 bg-zinc-50/40 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <SectionHeading
              title="Stay organized when it matters"
              lead="Quoting is the front end of the job. JobProof also helps you keep a clear record as work progresses."
            />
            <div className="mt-10 space-y-5 text-base leading-relaxed text-zinc-600 sm:text-lg sm:leading-8">
              <p>
                When customer approvals, photos, documentation, change orders, and project history
                live in one system, you have what you need if questions come up later—not a scramble
                to piece together what was agreed.
              </p>
              <p>
                That&apos;s not about fear. It&apos;s about running a professional business where nothing
                important gets lost and you can get paid with confidence.
              </p>
            </div>
            <ul className="mt-8 flex flex-wrap justify-center gap-3">
              {[
                "Customer approvals",
                "Photos",
                "Documentation",
                "Change orders",
                "Project history",
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

        {/* Final CTA */}
        <section className="bg-zinc-950 px-6 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4DBACC]">
              Get started
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              From first inquiry to signed quote.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-zinc-300">
              Try JobProof free for 14 days and see how much smoother quoting can be when everything
              lives in one place.
            </p>
            <div className="mt-10 flex flex-col items-center">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-zinc-950 transition-colors hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-950 sm:w-auto"
              >
                Start Your 14-Day Free Trial
              </Link>
              <p className="mt-3 text-sm text-zinc-400">No credit card required.</p>
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
