"use client";

import { useState } from "react";
import Link from "next/link";
import {
  SEND_QUOTE_REQUEST_LABEL,
  SendQuoteRequestButton,
  primaryButtonClassName,
} from "@/components/send-quote-request";
import { ProtectedJobSampleCard } from "@/components/onboarding/protected-job-sample-card";
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
  "Text your quote-request link to a customer who wants a price. They describe the job and add photos, so you can size up the work before you call back and send your quote sooner.";
export const FULL_DASHBOARD_TRANSITION_NOTE =
  "Your full dashboard opens automatically once you create your first job or invoice.";

export function formatReceivedQuoteRequests(count: number): string {
  return count === 1
    ? "You've received 1 quote request. Review it"
    : `You've received ${count} quote requests. Review them`;
}

const actionRowClassName =
  "flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2436BB]";

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function Chevron() {
  return (
    <span className="shrink-0 text-zinc-400" aria-hidden="true">
      →
    </span>
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
          {FIRST_TIME_DASHBOARD_HEADING}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-zinc-600 sm:text-base">
          {FIRST_TIME_DASHBOARD_INTRO}
        </p>
      </div>

      <section
        aria-labelledby="first-quote-request-heading"
        className="rounded-xl border border-[#2436BB]/25 bg-white p-5 shadow-sm sm:p-6"
      >
        <h2
          id="first-quote-request-heading"
          className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl"
        >
          {quoteRequestCardTitle(quoteRequestCount)}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-zinc-600 sm:text-base">{FIRST_QUOTE_REQUEST_BODY}</p>
        <div className="mt-4">
          {quoteUrl ? (
            <SendQuoteRequestButton
              quoteUrl={quoteUrl}
              businessName={businessName}
              sourceLocation="dashboard"
              className={`${primaryButtonClassName} w-full sm:w-auto`}
            >
              {SEND_QUOTE_REQUEST_LABEL}
            </SendQuoteRequestButton>
          ) : (
            <Link href={QUOTE_REQUEST_SETTINGS_PATH} className={`${primaryButtonClassName} w-full sm:w-auto`}>
              Set up your quote link
            </Link>
          )}
        </div>
        {quoteRequestCount > 0 ? (
          <Link
            href="/quote-requests"
            className="mt-4 flex min-h-12 items-center justify-between gap-3 rounded-lg bg-[#2436BB]/5 px-4 py-3 text-sm font-medium text-[#2436BB] transition-colors hover:bg-[#2436BB]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB]"
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
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <li>
            <Link href="/sample-quote?from=dashboard" className={actionRowClassName}>
              <span>View a sample quote</span>
              <Chevron />
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={openSampleJob}
              aria-expanded={showSampleJob}
              aria-controls="first-time-sample-job"
              className={actionRowClassName}
            >
              <span>Explore a sample job</span>
              <Chevron />
            </button>
          </li>
          {missingProfileDetails.length > 0 ? (
            <li>
              <Link href="/settings/business?returnTo=%2Fdashboard" className={actionRowClassName}>
                <span className="min-w-0">
                  <span className="block">Complete your business profile</span>
                  <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                    Add your {formatList(missingProfileDetails).toLowerCase()} before sending
                    contracts or invoices.
                  </span>
                </span>
                <Chevron />
              </Link>
            </li>
          ) : null}
        </ul>
      </section>

      {showSampleJob ? (
        <ProtectedJobSampleCard id="first-time-sample-job" />
      ) : (
        <div id="first-time-sample-job" hidden />
      )}

      <div className="text-center text-sm">
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
