import { createClient } from "@/lib/supabase/server";

export const QUOTE_RESPONSE_OVERDUE_HOURS = 24;
export const QUOTE_RESPONSE_OVERDUE_MS = QUOTE_RESPONSE_OVERDUE_HOURS * 60 * 60 * 1000;

export function getOverdueThresholdIso(now: Date = new Date()): string {
  return new Date(now.getTime() - QUOTE_RESPONSE_OVERDUE_MS).toISOString();
}

export function isQuoteRequestOverdue(
  status: string,
  submittedAt: string,
  now: Date = new Date()
): boolean {
  if (status !== "new") return false;
  const submitted = new Date(submittedAt);
  if (Number.isNaN(submitted.getTime())) return false;
  return now.getTime() - submitted.getTime() > QUOTE_RESPONSE_OVERDUE_MS;
}

export function hoursSinceSubmission(submittedAt: string, now: Date = new Date()): number {
  const submitted = new Date(submittedAt);
  if (Number.isNaN(submitted.getTime())) return 0;
  return Math.max(0, (now.getTime() - submitted.getTime()) / (1000 * 60 * 60));
}

export type QuoteRequestAlertCounts = {
  newCount: number;
  overdueCount: number;
};

async function countNewQuoteRequests(
  contractorId: string,
  options?: { overdueOnly?: boolean }
): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("quote_requests")
    .select("id", { count: "exact", head: true })
    .eq("contractor_id", contractorId)
    .eq("status", "new");

  if (options?.overdueOnly) {
    query = query.lt("submitted_at", getOverdueThresholdIso());
  }

  const { count, error } = await query;
  if (error) {
    console.error("[quote-request-response-alerts] count failed", error);
    return 0;
  }
  return count ?? 0;
}

export async function getNewQuoteRequestCount(contractorId: string): Promise<number> {
  return countNewQuoteRequests(contractorId);
}

export async function getOverdueQuoteRequestCount(contractorId: string): Promise<number> {
  return countNewQuoteRequests(contractorId, { overdueOnly: true });
}

/** Parallel head counts for dashboard and nav badge. */
export async function getQuoteRequestAlertCounts(
  contractorId: string
): Promise<QuoteRequestAlertCounts> {
  const [newCount, overdueCount] = await Promise.all([
    getNewQuoteRequestCount(contractorId),
    getOverdueQuoteRequestCount(contractorId),
  ]);
  return { newCount, overdueCount };
}

export type AdminQuoteRequestMetrics = {
  newCount: number;
  overdueCount: number;
  averageResponseTimeLabel: string;
};

/**
 * Platform-wide quote request metrics for admin analytics.
 * Average response time is reserved for a future status-history implementation.
 */
export async function getAdminQuoteRequestMetrics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<AdminQuoteRequestMetrics> {
  const threshold = getOverdueThresholdIso();

  const [{ count: newCount }, { count: overdueCount }] = await Promise.all([
    supabase
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .lt("submitted_at", threshold),
  ]);

  return {
    newCount: newCount ?? 0,
    overdueCount: overdueCount ?? 0,
    averageResponseTimeLabel: "Coming soon",
  };
}
