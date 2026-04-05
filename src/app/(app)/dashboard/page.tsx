import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { isBusinessProfileCompleteForApp } from "@/lib/validation/business-profile";
import {
  getProfile,
  getActiveJobsCount,
  getStorageUsage,
  getJobs,
  getInvoiceDeliverySummaryForJobIds,
} from "../actions";
import { DashboardAlerts } from "./dashboard-alerts";
import { getCompletedJobInvoiceUi } from "@/lib/completed-job-invoice-ui";
import {
  EMPTY_JOB_OUTSTANDING,
  getJobOutstandingIndicators,
  getJobPrimaryLifecycleStatus,
  outstandingIndicatorLinkClassName,
} from "@/lib/job-dashboard-status";

function formatStorage(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DashboardPage() {
  const [profile, activeCount, storageBytes, jobs, supabase] = await Promise.all([
    getProfile(),
    getActiveJobsCount(),
    getStorageUsage(),
    getJobs(),
    createClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const businessProfileComplete =
    profile &&
    user &&
    isBusinessProfileCompleteForApp({
      business_name: profile.business_name,
      account_email: user.email ?? "",
      phone: profile.phone,
      address_line_1: profile.address_line_1,
      city: profile.city,
      province: profile.province,
      postal_code: profile.postal_code,
    });

  const storageLimitBytes = (profile?.storage_limit_mb ?? 10240) * 1024 * 1024;
  const storagePercent = storageLimitBytes > 0
    ? Math.round(((storageBytes ?? 0) / storageLimitBytes) * 100)
    : 0;
  const isStorageNearLimit = storagePercent >= 80;
  const isJobLimitReached =
    (activeCount ?? 0) >= (profile?.active_job_limit ?? 10);

  const jobIds = jobs.map((j: { id: string }) => j.id);
  const invByJob = await getInvoiceDeliverySummaryForJobIds(jobIds);

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <DashboardAlerts />
      </Suspense>
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-zinc-600">
          Welcome back. Here&apos;s an overview of your jobs.
        </p>
      </div>

      {/* Business profile banner */}
      {!businessProfileComplete && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Complete your business profile to send contracts and invoices.{" "}
          <Link href="/settings/business" className="font-medium underline hover:no-underline">
            Add business details →
          </Link>
        </div>
      )}

      {/* Alerts */}
      {(isStorageNearLimit || isJobLimitReached) && (
        <div className="space-y-3">
          {isStorageNearLimit && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Storage is {storagePercent}% full ({formatStorage(storageBytes ?? 0)} / {formatStorage(storageLimitBytes)}).
              Consider removing old attachments or upgrading your plan.
            </div>
          )}
          {isJobLimitReached && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              You&apos;ve reached your active job limit ({profile?.active_job_limit ?? 10}).
              Complete or cancel jobs to create new ones, or upgrade your plan.
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
          <p className="text-sm font-medium text-zinc-500">Plan</p>
          <p className="mt-1 text-lg font-semibold capitalize text-zinc-900">
            {profile?.plan_type ?? "Solo"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 capitalize">
            {profile?.subscription_status ?? "Trial"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
          <p className="text-sm font-medium text-zinc-500">Active jobs</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">
            {activeCount ?? 0}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Signed contracts only • of {profile?.active_job_limit ?? 10} limit
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
          <p className="text-sm font-medium text-zinc-500">Storage used</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">
            {formatStorage(storageBytes ?? 0)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            of {(profile?.storage_limit_mb ?? 10240)} MB
          </p>
        </div>
      </div>

      {/* Job list */}
      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 sm:px-6">
          <h2 className="font-semibold text-zinc-900">Recent jobs</h2>
          <Link
            href="/jobs/create"
            className="rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Create job
          </Link>
        </div>
        <div className="divide-y divide-zinc-200">
          {jobs.length === 0 ? (
            <div className="px-4 py-12 text-center text-zinc-500 sm:px-6">
              <p>No jobs yet.</p>
              <p className="mt-2 text-sm text-zinc-600">
                Use <span className="font-medium text-zinc-800">Create job</span> above to get started.
              </p>
            </div>
          ) : (
            jobs.map((job: {
              id: string;
              title: string;
              status: string;
              contract_status?: string | null;
              customers: { full_name?: string } | { full_name?: string }[] | null;
              current_contract_total?: number | null;
              original_contract_price?: number | null;
            }) => {
              const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
              const primary = getJobPrimaryLifecycleStatus(job);
              const inv = invByJob[job.id] ?? EMPTY_JOB_OUTSTANDING;
              const outstanding = getJobOutstandingIndicators(job.id, job, inv);
              const invoiceUi =
                job.status === "completed" && job.contract_status === "signed"
                  ? getCompletedJobInvoiceUi(job.id, inv)
                  : null;
              return (
              <div
                key={job.id}
                className="flex flex-col gap-2 px-4 py-4 sm:px-6"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="block rounded-lg px-1 py-0.5 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900">{job.title}</p>
                        <p className="text-sm text-zinc-500">
                          {customer?.full_name ?? "Unknown customer"}
                        </p>
                      </div>
                      {(job.current_contract_total ?? job.original_contract_price) != null && (
                        <span className="shrink-0 text-sm font-medium text-zinc-700 sm:text-right">
                          ${Number(job.current_contract_total ?? job.original_contract_price).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${primary.badgeClass}`}
                    >
                      {primary.label}
                    </span>
                    {outstanding.length > 0 && (
                      <ul
                        className="contents m-0 list-none p-0"
                        aria-label="Outstanding actions for this job"
                      >
                        {outstanding.map((ind) => (
                          <li key={ind.id} className="inline">
                            <Link
                              href={ind.href}
                              aria-label={ind.ariaLabel}
                              className={`${outstandingIndicatorLinkClassName} ${ind.badgeClass}`}
                            >
                              {ind.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    {invoiceUi && (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight ${invoiceUi.statusBadgeClass}`}
                      >
                        {invoiceUi.statusLabel}
                      </span>
                    )}
                  </div>
                </div>
                {invoiceUi && (
                  <Link
                    href={invoiceUi.invoicesHref}
                    aria-label={`${invoiceUi.actionLabel} for ${job.title}`}
                    className="shrink-0 self-start rounded-lg bg-[#2436BB] px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 sm:self-start"
                  >
                    {invoiceUi.actionLabel}
                  </Link>
                )}
                </div>
                {invoiceUi?.billingDetailLine && (
                  <p className="px-1 text-xs leading-snug text-zinc-600">
                    {invoiceUi.billingDetailLine}
                  </p>
                )}
                {invoiceUi?.viewedDetailLine && (
                  <p className="px-1 text-xs leading-snug text-zinc-500">
                    {invoiceUi.viewedDetailLine}
                  </p>
                )}
              </div>
            );
            })
          )}
        </div>
      </div>
    </div>
  );
}
