"use client";

import { useState } from "react";
import Link from "next/link";
import { ProtectedJobSampleCard } from "./protected-job-sample-card";
import {
  trackOnboardingStartedAction,
  trackSampleJobViewedAction,
} from "@/app/(app)/product-analytics-actions";

export function DashboardEmptyOnboarding() {
  const [showSample, setShowSample] = useState(false);

  function trackStarted(source: string) {
    void trackOnboardingStartedAction(source).catch(() => undefined);
  }

  function scrollToSample() {
    trackStarted("dashboard_view_sample_button");
    void trackSampleJobViewedAction().catch(() => undefined);
    setShowSample(true);
    requestAnimationFrame(() => {
      document.getElementById("protected-job-sample")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="dashboard-start-job-heading"
        className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6"
      >
        <h2
          id="dashboard-start-job-heading"
          className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl"
        >
          Ready to start a job?
        </h2>
        <p className="mt-2 max-w-xl text-sm text-zinc-600 sm:text-base">
          Create a job, document the work, get approvals, send invoices and keep everything in one
          protected timeline.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/jobs/create"
            onClick={() => trackStarted("dashboard_create_first_job_cta")}
            className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-[#2436BB] px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
          >
            Create a job
          </Link>
          <button
            type="button"
            onClick={() => void scrollToSample()}
            className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
          >
            View sample job
          </button>
        </div>
      </section>

      {showSample ? <ProtectedJobSampleCard /> : null}
    </div>
  );
}
