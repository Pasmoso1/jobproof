import type { SupabaseClient } from "@supabase/supabase-js";

/** `/dashboard?view=full` always shows the regular dashboard. */
export const FULL_DASHBOARD_VIEW = "full";
export const FULL_DASHBOARD_PATH = `/dashboard?view=${FULL_DASHBOARD_VIEW}`;
export const GETTING_STARTED_DASHBOARD_PATH = "/dashboard";

export type DashboardActivityCounts = {
  /** null when the count could not be loaded — treated as "has activity" (fail safe). */
  jobCount: number | null;
  invoiceCount: number | null;
  quoteRequestCount: number | null;
};

/**
 * Getting-started guidance stays available until the contractor has created a job or an invoice.
 * Quote requests and estimates alone don't end it. Based on product data only (no cookies or
 * local flags), so the result is the same after a refresh, on another device or after signing in
 * again. Any count that failed to load disqualifies, so established accounts never lose the
 * regular dashboard because of a query error.
 */
export function isGettingStartedEligible(counts: DashboardActivityCounts): boolean {
  if (counts.jobCount === null || counts.invoiceCount === null || counts.quoteRequestCount === null) {
    return false;
  }
  return counts.jobCount === 0 && counts.invoiceCount === 0;
}

export function shouldShowFirstTimeDashboard(
  counts: DashboardActivityCounts,
  view?: string | null
): boolean {
  return view !== FULL_DASHBOARD_VIEW && isGettingStartedEligible(counts);
}

/** The regular dashboard links back to getting started only while the contractor still qualifies. */
export function shouldOfferBackToGettingStarted(
  counts: DashboardActivityCounts,
  view?: string | null
): boolean {
  return view === FULL_DASHBOARD_VIEW && isGettingStartedEligible(counts);
}

/** Counts reported by the regular dashboard loaders already prove activity; skip the extra queries. */
export const ACTIVE_ACCOUNT_COUNTS: DashboardActivityCounts = {
  jobCount: 1,
  invoiceCount: 1,
  quoteRequestCount: null,
};

async function headCount(
  supabase: SupabaseClient,
  table: "jobs" | "invoices" | "quote_requests",
  column: "profile_id" | "contractor_id",
  profileId: string
): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(column, profileId);
    if (error) {
      console.error("[dashboard-first-time] count failed", { table, code: error.code });
      return null;
    }
    return count ?? 0;
  } catch {
    console.error("[dashboard-first-time] count threw", { table });
    return null;
  }
}

/**
 * Dedicated error-aware counts: the regular dashboard loaders return empty lists on failure, which
 * would otherwise look like a brand-new account. `quote_requests` rows are only created when a
 * customer submits the public quote form (sharing a link creates none), so the count is "requests
 * received", across every status — the same rows the Quote Requests page lists.
 */
export async function loadDashboardActivityCounts(
  supabase: SupabaseClient,
  profileId: string
): Promise<DashboardActivityCounts> {
  const [jobCount, invoiceCount, quoteRequestCount] = await Promise.all([
    headCount(supabase, "jobs", "profile_id", profileId),
    headCount(supabase, "invoices", "profile_id", profileId),
    headCount(supabase, "quote_requests", "contractor_id", profileId),
  ]);
  return { jobCount, invoiceCount, quoteRequestCount };
}
