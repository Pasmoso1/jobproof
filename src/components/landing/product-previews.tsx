import type { ReactNode } from "react";
import {
  SAMPLE_QUOTE_CONTRACTOR,
  SAMPLE_QUOTE_META,
  SAMPLE_QUOTE_PROPOSAL,
} from "@/lib/sample-quote";
import { LandingIcon, type LandingIconName } from "./landing-icon";

function money(n: number) {
  return n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Static, non-interactive mock of a JobProof screen. Hidden from assistive tech; the figcaption describes it. */
function PreviewFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md"
    >
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
        <span className="text-xs font-semibold text-zinc-700">{label}</span>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
          Example
        </span>
      </div>
      <div className="space-y-3 p-4 text-left">{children}</div>
    </div>
  );
}

function RequestPreview() {
  return (
    <PreviewFrame label="New quote request">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#2436BB]">Sarah M.</p>
          <p className="text-xs text-zinc-500">Deck replacement · Oakville, ON</p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
          Needs Response
        </span>
      </div>
      <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-700">
        &ldquo;Our deck is about 15 years old and some boards are getting soft. We&apos;d like it
        replaced this summer.&rdquo;
      </p>
      <div className="flex flex-wrap gap-2 text-[11px] font-medium text-zinc-700">
        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-0.5">
          <LandingIcon name="camera" className="h-3.5 w-3.5" />3 photos
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-0.5">
          <LandingIcon name="checkCircle" className="h-3.5 w-3.5" />
          Follow-up questions answered
        </span>
      </div>
    </PreviewFrame>
  );
}

function BriefPreview() {
  return (
    <PreviewFrame label="Project Brief">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Items to Verify</p>
        <ul className="mt-1 space-y-1 text-xs text-zinc-700">
          <li>• Condition of existing footings</li>
          <li>• Permit requirements for the new deck</li>
        </ul>
      </div>
      <div className="rounded-lg border border-[#2436BB]/15 bg-[#2436BB]/5 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2436BB]">
          Recommended Next Step
        </p>
        <p className="mt-0.5 text-xs text-zinc-800">Book a site visit to measure and check the footings.</p>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Quote Preparation Checklist
        </p>
        <ul className="mt-1 space-y-1 text-xs text-zinc-700">
          <li className="flex items-center gap-1.5">
            <span className="font-bold text-emerald-600">✓</span> Customer photos reviewed
          </li>
          <li className="flex items-center gap-1.5">
            <span className="font-bold text-emerald-600">✓</span> Deck measured on site
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm border border-zinc-300" /> Material pricing
          </li>
        </ul>
      </div>
    </PreviewFrame>
  );
}

function ProposalPreview() {
  const proposal = SAMPLE_QUOTE_PROPOSAL;
  return (
    <PreviewFrame label="Customer proposal">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2436BB]">Project Quote</p>
        <p className="mt-1 text-sm font-bold text-zinc-950">{SAMPLE_QUOTE_META.title}</p>
        <p className="text-xs text-zinc-500">{SAMPLE_QUOTE_CONTRACTOR.businessName}</p>
      </div>
      <ul className="space-y-1 text-xs text-zinc-700">
        {proposal.scopeOfWork.slice(0, 3).map((item) => (
          <li key={item} className="flex gap-1.5">
            <span className="font-semibold text-[#2436BB]">•</span>
            <span className="line-clamp-1">{item}</span>
          </li>
        ))}
      </ul>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
        <div className="flex justify-between text-[11px] text-zinc-600">
          <span>Tax ({proposal.taxRateLabel})</span>
          <span className="tabular-nums">${money(proposal.taxAmount)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-zinc-200 pt-1 text-sm font-semibold text-zinc-950">
          <span>Total</span>
          <span className="tabular-nums">${money(proposal.total)}</span>
        </div>
      </div>
    </PreviewFrame>
  );
}

function ApprovalPreview() {
  return (
    <PreviewFrame label="Customer view">
      <div className="space-y-2">
        <span className="block w-full rounded-xl bg-[#2436BB] px-4 py-2 text-center text-xs font-medium text-white">
          Accept Quote
        </span>
        <div className="grid grid-cols-2 gap-2">
          <span className="rounded-xl border border-zinc-300 px-2 py-2 text-center text-[11px] font-medium text-zinc-800">
            Request Changes
          </span>
          <span className="rounded-xl border border-zinc-300 px-2 py-2 text-center text-[11px] font-medium text-zinc-800">
            Ask a Question
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-center text-emerald-950">
        <p className="text-sm font-semibold">Quote Accepted</p>
        <p className="mt-0.5 text-[11px] leading-4">
          Your contractor has been notified and will follow up about next steps.
        </p>
      </div>
    </PreviewFrame>
  );
}

const JOURNEY: Array<{
  step: string;
  icon: LandingIconName;
  title: string;
  caption: string;
  preview: () => ReactNode;
}> = [
  {
    step: "1",
    icon: "inbox",
    title: "Customer request",
    caption: "Customers tell you what they need through your quote request link and can add photos.",
    preview: RequestPreview,
  },
  {
    step: "2",
    icon: "clipboard",
    title: "JobProof",
    caption: "A Project Brief and checklist help you get ready before the site visit.",
    preview: BriefPreview,
  },
  {
    step: "3",
    icon: "document",
    title: "Professional quote",
    caption: "Turn your notes into a clear proposal with scope, pricing and terms.",
    preview: ProposalPreview,
  },
  {
    step: "4",
    icon: "checkCircle",
    title: "Customer approval",
    caption: "Customers review it on any device and accept online when they're ready.",
    preview: ApprovalPreview,
  },
];

export function ProductJourneyPreviews() {
  return (
    <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
      {JOURNEY.map(({ step, icon, title, caption, preview: Preview }) => (
        <li key={step}>
          <figure className="flex h-full flex-col">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2436BB] text-xs font-bold text-white">
                {step}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-950">
                <LandingIcon name={icon} className="h-4 w-4 text-[#2436BB]" />
                {title}
              </span>
            </div>
            <Preview />
            <figcaption className="mt-3 text-sm leading-6 text-zinc-600">{caption}</figcaption>
          </figure>
        </li>
      ))}
    </ol>
  );
}
