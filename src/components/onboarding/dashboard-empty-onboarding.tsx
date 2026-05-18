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
      <section className="rounded-xl border border-[#2436BB]/25 bg-white p-5 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-[#2436BB]">Payment protection for contractors</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Start protecting your first job
        </h2>
        <p className="mt-2 max-w-xl text-sm text-zinc-600 sm:text-base">
          Create a job, add proof, get approvals, and send invoices from one protected timeline.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/jobs/create"
            onClick={() => trackStarted("dashboard_create_first_job_cta")}
            className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-[#2436BB] px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
          >
            Create your first protected job
          </Link>
          <button
            type="button"
            onClick={() => void scrollToSample()}
            className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
          >
            View sample protected job
          </button>
        </div>
      </section>

      {showSample ? <ProtectedJobSampleCard /> : null}
    </div>
  );
}
