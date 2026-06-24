import Link from "next/link";
import { getQuoteRequestAlertCounts, isQuoteRequestOverdue } from "@/lib/quote-requests/response-alerts";

export function QuoteRequestResponseListBadge({
  status,
  submittedAt,
}: {
  status: string;
  submittedAt: string;
}) {
  if (status !== "new") return null;

  if (isQuoteRequestOverdue(status, submittedAt)) {
    return (
      <span className="inline-flex rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">
        ⚠ Overdue
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
      Needs Response
    </span>
  );
}

export function QuoteRequestNeedsResponseBanner({
  status,
  submittedAt,
}: {
  status: string;
  submittedAt: string;
}) {
  if (status !== "new" || isQuoteRequestOverdue(status, submittedAt)) return null;

  return (
    <div
      className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <p className="font-semibold">Needs Response</p>
      <p className="mt-1 text-amber-900">
        This quote request is waiting for your first response.
      </p>
    </div>
  );
}

export function QuoteRequestOverdueBanner({
  status,
  submittedAt,
}: {
  status: string;
  submittedAt: string;
}) {
  if (status !== "new" || !isQuoteRequestOverdue(status, submittedAt)) return null;

  return (
    <div
      className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
      role="alert"
    >
      <p className="font-semibold">⚠ Response overdue</p>
      <p className="mt-1 text-red-800">
        This quote request has not received a response within 24 hours.
      </p>
    </div>
  );
}

export async function QuoteRequestDashboardAlerts({
  contractorId,
}: {
  contractorId: string;
}) {
  const { newCount, overdueCount } = await getQuoteRequestAlertCounts(contractorId);

  if (newCount === 0) return null;

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 sm:px-5">
      <h2 className="text-base font-semibold text-blue-950">Quote Request Alerts</h2>
      <p className="mt-2 text-sm text-blue-900">
        You have <span className="font-semibold">{newCount}</span> new quote{" "}
        {newCount === 1 ? "request" : "requests"}.
      </p>
      {overdueCount > 0 ? (
        <p className="mt-2 text-sm font-medium text-red-800">
          ⚠ {overdueCount} quote {overdueCount === 1 ? "request has" : "requests have"} not
          received a response within 24 hours.
        </p>
      ) : null}
      <Link
        href="/quote-requests"
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96]"
      >
        View Requests
      </Link>
    </section>
  );
}
