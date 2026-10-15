"use client";

import { useState } from "react";
import Link from "next/link";
import {
  SEND_QUOTE_REQUEST_LABEL,
  SendQuoteRequestButton,
  primaryButtonClassName,
} from "@/components/send-quote-request";
import { ProtectedJobSampleCard } from "@/components/onboarding/protected-job-sample-card";
import { LandingIcon, type LandingIconName } from "@/components/landing/landing-icon";
import {
  trackOnboardingStartedAction,
  trackSampleJobViewedAction,
} from "@/app/(app)/product-analytics-actions";
import { QUOTE_REQUEST_SETTINGS_PATH } from "@/lib/quote-link-share";
import { FULL_DASHBOARD_PATH } from "@/lib/dashboard-first-time";

export const FIRST_TIME_DASHBOARD_HEADING = "Welcome to JobProof!";
export const FIRST_TIME_DASHBOARD_INTRO =
  "Let's help you spend less time chasing quote details and more time winning jobs.";
export const FIRST_QUOTE_REQUEST_TITLE = "Get your first quote request";
export const MORE_QUOTE_REQUESTS_TITLE = "Get more quote requests";

export function quoteRequestCardTitle(quoteRequestCount: number): string {
  return quoteRequestCount > 0 ? MORE_QUOTE_REQUESTS_TITLE : FIRST_QUOTE_REQUEST_TITLE;
}
export const FIRST_QUOTE_REQUEST_BODY =
  "Text your link to a customer who wants a price. They describe the job and add photos, so you can size it up and send your quote sooner.";

export const QUOTE_REQUEST_WORKFLOW: ReadonlyArray<{
  icon: LandingIconName;
  label: string;
  note?: string;
}> = [
  { icon: "phone", label: "Customer contacts you" },
  { icon: "send", label: "Send your quote-request link" },
  { icon: "camera", label: "Customer provides details and photos", note: "Less back-and-forth" },
  { icon: "clipboard", label: "Review the job and prepare your quote" },
];

export const SAMPLE_QUOTE_CARD = {
  title: "See a professional quote",
  body: "Preview the type of quote you can send to customers.",
  cta: "View sample quote",
  href: "/sample-quote?from=dashboard",
} as const;
export const SAMPLE_JOB_CARD = {
  title: "Explore a sample job",
  body: "See how JobProof organizes project details, photos, approvals, and records.",
  cta: "Explore sample job",
  hideCta: "Hide sample job",
} as const;

export const PROFILE_CARD_TITLE = "Complete your business profile";
export const PROFILE_CARD_BODY =
  "Add your business contact details so your quotes, contracts, and invoices are ready to send.";
export const PROFILE_CARD_CTA = "Add business details";
export const BUSINESS_SETTINGS_FROM_DASHBOARD_PATH = "/settings/business?returnTo=%2Fdashboard";

export const FULL_DASHBOARD_TRANSITION_NOTE =
  "Your full dashboard opens automatically once you create your first job or invoice.";

export function formatReceivedQuoteRequests(count: number): string {
  return count === 1
    ? "You've received 1 quote request. Review it"
    : `You've received ${count} quote requests. Review them`;
}

export function formatMissingProfileDetails(items: string[]): string {
  return `Still needed: ${formatList(items).toLowerCase()}. No rush — your trial is already active.`;
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const cardClassName = "rounded-xl border border-zinc-200 bg-white";

/** The CTA's ::after covers the whole card so the full card is a tap target. */
const stretchedCtaClassName =
  "mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-[#2436BB] after:absolute after:inset-0 after:rounded-xl focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[#2436BB]";

function CardIcon({ name }: { name: LandingIconName }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2436BB]/10 text-[#2436BB]">
      <LandingIcon name={name} className="h-5 w-5" />
    </span>
  );
}

function KeepHyphenatedWordsTogether({ text }: { text: string }) {
  return text.split(/(\S+-\S+)/).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="inline-block">
        {part}
      </span>
    ) : (
      part
    )
  );
}

function QuoteRequestWorkflow() {
  return (
    <ol
      aria-label="How a quote request works"
      className="mt-3 grid gap-1.5 rounded-lg bg-zinc-50 px-3 py-2.5 md:mt-4 md:grid-cols-4 md:gap-3 md:p-4"
    >
      {QUOTE_REQUEST_WORKFLOW.map((step, i) => {
        const isContractorStep = i === 1;
        return (
          <li
            key={step.label}
            className="relative flex items-start gap-2.5 md:flex-col md:items-center md:gap-2 md:text-center"
          >
            {i < QUOTE_REQUEST_WORKFLOW.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute -bottom-1.5 left-3.5 top-7 w-px bg-[#2436BB]/20 md:bottom-auto md:left-[calc(50%+20px)] md:top-4 md:h-px md:w-[calc(100%-28px)]"
              />
            ) : null}
            <span
              className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full md:h-8 md:w-8 ${
                isContractorStep ? "bg-[#2436BB] text-white" : "bg-white text-[#2436BB] ring-1 ring-[#2436BB]/20"
              }`}
            >
              <LandingIcon name={step.icon} className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </span>
            <span className="min-w-0 pt-[5px] text-[13px] leading-[18px] md:pt-0 md:text-sm md:leading-5">
              <span className="sr-only">{`Step ${i + 1}: `}</span>
              <span className="font-medium text-zinc-900">
                <KeepHyphenatedWordsTogether text={step.label} />
              </span>
              {step.note ? (
                <span className="hidden text-xs text-zinc-500 md:block">{step.note}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function FirstTimeDashboard({
  quoteUrl,
  businessName,
  missingProfileDetails,
  quoteRequestCount = 0,
}: {
  /** Null when the quote link isn't available yet (slug allocation failed). */
  quoteUrl: string | null;
  businessName: string | null;
  /** Human-readable labels, e.g. ["Business phone", "Business address"]. */
  missingProfileDetails: string[];
  quoteRequestCount?: number;
}) {
  const [showSampleJob, setShowSampleJob] = useState(false);

  function openSampleJob() {
    if (!showSampleJob) {
      void trackOnboardingStartedAction("dashboard_first_time_sample_job").catch(() => undefined);
      void trackSampleJobViewedAction().catch(() => undefined);
    }
    setShowSampleJob((v) => !v);
    requestAnimationFrame(() => {
      document.getElementById("first-time-sample-job")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
          {FIRST_TIME_DASHBOARD_HEADING}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-zinc-600 sm:text-base">
          {FIRST_TIME_DASHBOARD_INTRO}
        </p>
      </div>

      <section
        aria-labelledby="first-quote-request-heading"
        className="rounded-xl border border-[#2436BB]/25 bg-white p-4 shadow-sm sm:p-6"
      >
        <h2
          id="first-quote-request-heading"
          className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl"
        >
          {quoteRequestCardTitle(quoteRequestCount)}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-zinc-600 sm:text-base">
          {FIRST_QUOTE_REQUEST_BODY}
        </p>
        <QuoteRequestWorkflow />
        <div className="mt-4">
          {quoteUrl ? (
            <SendQuoteRequestButton
              quoteUrl={quoteUrl}
              businessName={businessName}
              sourceLocation="dashboard"
              className={`${primaryButtonClassName} w-full text-base sm:w-auto sm:min-w-56`}
            >
              {SEND_QUOTE_REQUEST_LABEL}
            </SendQuoteRequestButton>
          ) : (
            <Link
              href={QUOTE_REQUEST_SETTINGS_PATH}
              className={`${primaryButtonClassName} w-full text-base sm:w-auto sm:min-w-56`}
            >
              Set up your quote link
            </Link>
          )}
        </div>
        {quoteRequestCount > 0 ? (
          <Link
            href="/quote-requests"
            className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-lg bg-[#2436BB]/5 px-4 py-3 text-sm font-medium text-[#2436BB] transition-colors hover:bg-[#2436BB]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB]"
          >
            <span>{formatReceivedQuoteRequests(quoteRequestCount)}</span>
            <span className="shrink-0" aria-hidden="true">
              →
            </span>
          </Link>
        ) : null}
      </section>

      <section aria-labelledby="first-time-explore-heading">
        <h2 id="first-time-explore-heading" className="sr-only">
          Explore JobProof
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div
            className={`${cardClassName} relative flex items-start gap-3 p-4 transition-colors hover:border-[#2436BB]/40`}
          >
            <CardIcon name="document" />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-zinc-900">{SAMPLE_QUOTE_CARD.title}</h3>
              <p className="mt-0.5 text-sm text-zinc-600">{SAMPLE_QUOTE_CARD.body}</p>
              <Link href={SAMPLE_QUOTE_CARD.href} className={stretchedCtaClassName}>
                {SAMPLE_QUOTE_CARD.cta}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <div
            className={`${cardClassName} relative flex items-start gap-3 p-4 transition-colors hover:border-[#2436BB]/40`}
          >
            <CardIcon name="folder" />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-zinc-900">{SAMPLE_JOB_CARD.title}</h3>
              <p className="mt-0.5 text-sm text-zinc-600">{SAMPLE_JOB_CARD.body}</p>
              <button
                type="button"
                onClick={openSampleJob}
                aria-expanded={showSampleJob}
                aria-controls="first-time-sample-job"
                className={stretchedCtaClassName}
              >
                {showSampleJob ? SAMPLE_JOB_CARD.hideCta : SAMPLE_JOB_CARD.cta}
                <span aria-hidden="true">{showSampleJob ? "↑" : "→"}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {showSampleJob ? (
        <ProtectedJobSampleCard id="first-time-sample-job" />
      ) : (
        <div id="first-time-sample-job" hidden />
      )}

      {missingProfileDetails.length > 0 ? (
        <section
          aria-labelledby="first-time-profile-heading"
          className={`${cardClassName} relative flex items-start gap-3 p-4 transition-colors hover:border-[#2436BB]/40`}
        >
          <CardIcon name="pen" />
          <div className="min-w-0">
            <h2 id="first-time-profile-heading" className="text-base font-semibold text-zinc-900">
              {PROFILE_CARD_TITLE}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-600">{PROFILE_CARD_BODY}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {formatMissingProfileDetails(missingProfileDetails)}
            </p>
            <Link href={BUSINESS_SETTINGS_FROM_DASHBOARD_PATH} className={stretchedCtaClassName}>
              {PROFILE_CARD_CTA}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      ) : null}

      <div className="pt-1 text-center text-sm">
        <p className="text-xs text-zinc-500">{FULL_DASHBOARD_TRANSITION_NOTE}</p>
        <Link
          href={FULL_DASHBOARD_PATH}
          className="inline-flex min-h-11 items-center font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
        >
          View full dashboard
        </Link>
      </div>
    </div>
  );
}
