import Link from "next/link";
import { QuoteRequestUrgentListBadge } from "@/components/quote-request-urgency";
import { formatDateTimeEastern } from "@/lib/datetime-eastern";
import {
  quoteRequestListBucket,
  quoteRequestStatusLabel,
} from "@/lib/quote-requests/constants";
import {
  getQuoteRequestsList,
  type QuoteRequestListRow,
} from "./quote-request-actions";

export const dynamic = "force-dynamic";

function statusPill(status: string) {
  const label = quoteRequestStatusLabel(status);
  let cls = "bg-zinc-100 text-zinc-800";
  if (status === "new") cls = "bg-blue-50 text-blue-800";
  if (status === "reviewed" || status === "site_visit_requested") cls = "bg-amber-50 text-amber-900";
  if (status === "responded") cls = "bg-emerald-50 text-emerald-900";
  if (status === "closed" || status === "converted") cls = "bg-zinc-200 text-zinc-700";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function RequestTable({ rows }: { rows: QuoteRequestListRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No requests in this section.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-4 py-2 font-semibold text-zinc-700">Customer</th>
            <th className="px-4 py-2 font-semibold text-zinc-700">Project type</th>
            <th className="px-4 py-2 font-semibold text-zinc-700">Urgent</th>
            <th className="px-4 py-2 font-semibold text-zinc-700">Submitted</th>
            <th className="px-4 py-2 font-semibold text-zinc-700">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3">
                <Link
                  href={`/quote-requests/${r.id}`}
                  className="font-medium text-[#2436BB] hover:underline"
                >
                  {r.customer_name}
                </Link>
                <div className="text-xs text-zinc-500">{r.customer_email}</div>
              </td>
              <td className="px-4 py-3 text-zinc-700">{r.project_type}</td>
              <td className="px-4 py-3">
                <QuoteRequestUrgentListBadge isUrgent={r.is_urgent} />
              </td>
              <td className="px-4 py-3 text-zinc-600">
                {formatDateTimeEastern(r.submitted_at)}
              </td>
              <td className="px-4 py-3">{statusPill(r.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: QuoteRequestListRow[];
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <p className="text-sm text-zinc-600">{description}</p>
      </div>
      <RequestTable rows={rows} />
    </section>
  );
}

export default async function QuoteRequestsPage() {
  const rows = await getQuoteRequestsList();

  const newRows = rows.filter((r) => quoteRequestListBucket(r.status) === "new");
  const awaiting = rows.filter((r) => quoteRequestListBucket(r.status) === "awaiting");
  const responded = rows.filter((r) => quoteRequestListBucket(r.status) === "responded");
  const closed = rows.filter((r) => quoteRequestListBucket(r.status) === "closed");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Quote requests</h1>
          <p className="mt-1 text-zinc-600">
            Project inquiries from your public quote page, before a job is created.
          </p>
        </div>
        <Link
          href="/settings/quote-requests"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Quote page settings
        </Link>
      </div>

      <Section
        title="New"
        description="Just submitted — not yet reviewed."
        rows={newRows}
      />
      <Section
        title="Awaiting response"
        description="Reviewed or site visit requested — follow up with the customer."
        rows={awaiting}
      />
      <Section
        title="Responded"
        description="You have responded to the customer."
        rows={responded}
      />
      <Section
        title="Closed"
        description="Closed or converted requests."
        rows={closed}
      />
    </div>
  );
}
