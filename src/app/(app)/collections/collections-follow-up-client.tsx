"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DashboardReceivableRowActions } from "@/app/(app)/dashboard/dashboard-receivable-row-actions";
import {
  collectionsRowNeedsSoftReview,
  formatCollectionsContextLines,
  isRecentReminderEastern,
  type CollectionsCenterPayload,
  type CollectionsQueueKey,
  type CollectionsRow,
} from "@/lib/collections-center";

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SECTION_ORDER: CollectionsQueueKey[] = [
  "overdue_not_viewed",
  "overdue_viewed",
  "partial_on_track",
  "sent_not_viewed",
  "sent_on_track",
];

const SECTION_TITLE: Record<CollectionsQueueKey, string> = {
  overdue_not_viewed: "Overdue — not yet viewed",
  overdue_viewed: "Overdue — invoice viewed",
  partial_on_track: "Partially paid (on time)",
  sent_not_viewed: "Sent — not yet viewed",
  sent_on_track: "Sent — viewed, on schedule",
};

export type CollectionsFilterId =
  | "all"
  | "overdue"
  | "partial"
  | "not_viewed"
  | "viewed"
  | "recent_reminder"
  | "needs_review";

const FILTERS: { id: CollectionsFilterId; label: string }[] = [
  { id: "all", label: "All open" },
  { id: "overdue", label: "Overdue" },
  { id: "partial", label: "Partially paid" },
  { id: "not_viewed", label: "Not viewed" },
  { id: "viewed", label: "Viewed" },
  { id: "recent_reminder", label: "Recently reminded" },
  { id: "needs_review", label: "Needs review" },
];

function matchesFilter(row: CollectionsRow, filter: CollectionsFilterId, todayYmd: string): boolean {
  switch (filter) {
    case "all":
      return true;
    case "overdue":
      return row.queueKey === "overdue_not_viewed" || row.queueKey === "overdue_viewed";
    case "partial":
      return row.queueKey === "partial_on_track";
    case "not_viewed":
      if (row.queueKey === "overdue_not_viewed" || row.queueKey === "sent_not_viewed") return true;
      if (row.queueKey === "partial_on_track" && !row.viewedAt?.trim()) return true;
      return false;
    case "viewed":
      if (row.queueKey === "overdue_viewed" || row.queueKey === "sent_on_track") return true;
      if (row.queueKey === "partial_on_track" && row.viewedAt?.trim()) return true;
      return false;
    case "recent_reminder":
      return isRecentReminderEastern(row.lastReminderSuccessAt, todayYmd, 2);
    case "needs_review":
      return collectionsRowNeedsSoftReview(row);
    default:
      return true;
  }
}

export function CollectionsFollowUpClient({ data }: { data: CollectionsCenterPayload }) {
  const [filter, setFilter] = useState<CollectionsFilterId>("all");
  const { summary, rows, todayYmd } = data;

  const filtered = useMemo(
    () => rows.filter((r) => matchesFilter(r, filter, todayYmd)),
    [rows, filter, todayYmd]
  );

  const bySection = useMemo(() => {
    const m = new Map<CollectionsQueueKey, CollectionsRow[]>();
    for (const k of SECTION_ORDER) m.set(k, []);
    for (const r of filtered) {
      const list = m.get(r.queueKey);
      if (list) list.push(r);
    }
    return m;
  }, [filtered]);

  const hasAnyOpen = rows.length > 0;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">At a glance</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <p className="text-lg font-semibold text-zinc-900">${money(summary.totalOutstanding)}</p>
            <p className="text-xs text-zinc-500">Outstanding</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-red-800">${money(summary.overdueAmount)}</p>
            <p className="text-xs text-zinc-500">Overdue (AR)</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-amber-950">${money(summary.partiallyPaidAmount)}</p>
            <p className="text-xs text-zinc-500">Partial (on time)</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-900">{summary.notViewedOpenCount}</p>
            <p className="text-xs text-zinc-500">Open, not yet viewed</p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-lg font-semibold text-zinc-900">{summary.recentlyRemindedOpenCount}</p>
            <p className="text-xs text-zinc-500">Reminded (3d, Eastern)</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Filter</p>
        <div
          className="-mx-1 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible"
          role="tablist"
          aria-label="Collections filters"
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 ${
                  active
                    ? "border-[#2436BB] bg-[#2436BB] text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {!hasAnyOpen ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-600 sm:px-6">
          <p className="font-medium text-zinc-800">Nothing to follow up right now</p>
          <p className="mt-2">
            Open invoices will appear here when they are sent, overdue, or partially paid. Drafts stay
            on the job until you send them.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm font-medium text-[#2436BB] underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
          >
            Back to dashboard
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-600 sm:px-6">
          No invoices match this filter. Try <span className="font-medium">All open</span>.
        </div>
      ) : (
        <div className="space-y-10">
          {SECTION_ORDER.map((key) => {
            const sectionRows = bySection.get(key) ?? [];
            if (sectionRows.length === 0) return null;
            return (
              <section key={key} aria-labelledby={`collections-section-${key}`}>
                <h2
                  id={`collections-section-${key}`}
                  className="border-b border-zinc-200 pb-2 text-base font-semibold text-zinc-900"
                >
                  {SECTION_TITLE[key]}
                  <span className="ml-2 text-sm font-normal text-zinc-500">({sectionRows.length})</span>
                </h2>
                <ul className="mt-4 space-y-4">
                  {sectionRows.map((row) => (
                    <CollectionsRowCard key={row.invoiceId} row={row} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CollectionsRowCard({ row }: { row: CollectionsRow }) {
  const ctx = formatCollectionsContextLines(row);
  const showPartialHint =
    (row.queueKey === "overdue_not_viewed" || row.queueKey === "overdue_viewed") &&
    row.status === "partially_paid";

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-semibold text-zinc-900">{row.jobTitle}</p>
            <p className="text-sm text-zinc-600">{row.customerName}</p>
          </div>
          <p className="text-base font-semibold text-zinc-900">${money(row.balanceDue)} remaining</p>
          {showPartialHint ? (
            <p className="text-xs font-medium text-amber-900">Partially paid — balance still overdue</p>
          ) : null}
          <ul className="space-y-1 text-xs text-zinc-600">
            {ctx.dueLine ? <li>{ctx.dueLine}</li> : null}
            {ctx.sentLine ? <li>{ctx.sentLine}</li> : null}
            {ctx.viewedLine ? <li>{ctx.viewedLine}</li> : null}
            {ctx.lastPayLine ? <li>{ctx.lastPayLine}</li> : null}
            {ctx.reminderLine ? <li>{ctx.reminderLine}</li> : null}
            {ctx.paymentMethodLine ? <li>{ctx.paymentMethodLine}</li> : null}
          </ul>
          {ctx.spacingNote ? (
            <p className="text-xs text-zinc-500">{ctx.spacingNote}</p>
          ) : null}
          {ctx.mayHavePaid ? (
            <p className="text-xs font-medium text-amber-800">
              Customer may have paid — confirm before sending a reminder.
            </p>
          ) : null}
          <Link
            href={`/jobs/${row.jobId}`}
            className="inline-block text-xs font-medium text-[#2436BB] underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
          >
            Open job
          </Link>
        </div>
        <DashboardReceivableRowActions
          jobId={row.jobId}
          invoiceId={row.invoiceId}
          status={row.status}
          balanceDue={row.balanceDue}
          contractSigned={row.contractSigned}
        />
      </div>
    </li>
  );
}
