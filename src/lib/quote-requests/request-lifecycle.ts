import type { QuoteRequestStatus } from "@/lib/quote-requests/constants";

/**
 * Quote request lifecycle driven by the estimate created from it:
 * - new / reviewed / site_visit_requested: the customer is still waiting on the contractor.
 * - responded: the contractor has answered — manually, or by sending the customer a quote.
 * - converted: the customer accepted the quote (the "customer decision" success state).
 * - closed: the contractor closed or declined the request; automatic transitions never reopen it.
 */
export const QUOTE_REQUEST_STATUSES_AWAITING_RESPONSE = [
  "new",
  "reviewed",
  "site_visit_requested",
] as const satisfies readonly QuoteRequestStatus[];

export const QUOTE_REQUEST_STATUSES_CONVERTIBLE = [
  ...QUOTE_REQUEST_STATUSES_AWAITING_RESPONSE,
  "responded",
] as const satisfies readonly QuoteRequestStatus[];

function includesStatus(list: readonly string[], status: string): boolean {
  return list.includes(status);
}

export function quoteRequestStatusAfterQuoteSent(current: QuoteRequestStatus): QuoteRequestStatus {
  return includesStatus(QUOTE_REQUEST_STATUSES_AWAITING_RESPONSE, current) ? "responded" : current;
}

export function quoteRequestStatusAfterQuoteAccepted(
  current: QuoteRequestStatus
): QuoteRequestStatus {
  return includesStatus(QUOTE_REQUEST_STATUSES_CONVERTIBLE, current) ? "converted" : current;
}

/** Supabase client (user-scoped or service role); typed loosely so both clients are accepted. */
export type QuoteRequestLifecycleClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
};

type LifecycleTarget = { quoteRequestId: string; contractorId: string };

async function transitionQuoteRequest(
  client: QuoteRequestLifecycleClient,
  target: LifecycleTarget,
  nextStatus: QuoteRequestStatus,
  fromStatuses: readonly QuoteRequestStatus[],
  logLabel: string
): Promise<boolean> {
  const quoteRequestId = target.quoteRequestId.trim();
  const contractorId = target.contractorId.trim();
  if (!quoteRequestId || !contractorId) return false;

  const { data, error } = (await client
    .from("quote_requests")
    .update({ status: nextStatus })
    .eq("id", quoteRequestId)
    .eq("contractor_id", contractorId)
    .in("status", [...fromStatuses])
    .select("id")) as { data: unknown; error: unknown };

  if (error) {
    console.error(`[quote-request-lifecycle] ${logLabel} failed`, error);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * Called once a quote created from this request has been delivered to the customer.
 * The status filter makes this a no-op for requests that are already responded, converted or closed.
 */
export function markQuoteRequestRespondedAfterQuoteSent(
  client: QuoteRequestLifecycleClient,
  target: LifecycleTarget
): Promise<boolean> {
  return transitionQuoteRequest(
    client,
    target,
    "responded",
    QUOTE_REQUEST_STATUSES_AWAITING_RESPONSE,
    "mark responded"
  );
}

export function markQuoteRequestConvertedAfterQuoteAccepted(
  client: QuoteRequestLifecycleClient,
  target: LifecycleTarget
): Promise<boolean> {
  return transitionQuoteRequest(
    client,
    target,
    "converted",
    QUOTE_REQUEST_STATUSES_CONVERTIBLE,
    "mark converted"
  );
}
