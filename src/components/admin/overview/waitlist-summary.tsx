import Link from "next/link";
import { formatMetric } from "@/components/admin/overview/metric-card";
import type { WaitlistOverview } from "@/lib/admin/overview-data";

export function WaitlistSummary({ data }: { data: WaitlistOverview }) {
  return (
    <section
      aria-labelledby="early-access-heading"
      className="rounded-lg border border-[#2436BB]/25 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="early-access-heading" className="text-base font-semibold text-zinc-900">
            Early access signups
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Homepage waitlist — total and recent volume (rolling 7 days).
          </p>
        </div>
        <div className="flex flex-wrap gap-4 sm:gap-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{formatMetric(data.total)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Last 7 days</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">
              {formatMetric(data.last7Days)}
            </p>
          </div>
        </div>
        <Link
          href="/admin/waitlist"
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
        >
          View waitlist
        </Link>
      </div>
    </section>
  );
}
