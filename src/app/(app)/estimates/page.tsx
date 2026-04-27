import Link from "next/link";
import { formatDateEastern } from "@/lib/datetime-eastern";
import { getEstimatesList, type EstimateListRow } from "@/app/(app)/estimates/estimate-actions";

export const dynamic = "force-dynamic";

function bucket(e: EstimateListRow): string {
  const d = e.displayStatus;
  if (d === "draft") return "draft";
  if (d === "accepted") return "accepted";
  if (d === "declined") return "declined";
  if (d === "expired") return "expired";
  if (d === "viewed") return "awaiting";
  if (d === "sent") return "sent";
  return "sent";
}

function statusPill(label: string) {
  const styles: Record<string, string> = {
    Draft: "bg-zinc-100 text-zinc-800",
    Sent: "bg-blue-50 text-blue-800",
    "Awaiting response": "bg-amber-50 text-amber-900",
    Accepted: "bg-emerald-50 text-emerald-900",
    Declined: "bg-red-50 text-red-800",
    Expired:
      "border border-zinc-400 bg-zinc-100 font-semibold text-zinc-900 ring-1 ring-zinc-300/60",
  };
  const cls = styles[label] ?? "bg-zinc-100 text-zinc-800";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function displayLabel(e: EstimateListRow): string {
  const d = e.displayStatus;
  if (d === "draft") return "Draft";
  if (d === "sent") return "Sent";
  if (d === "viewed") return "Awaiting response";
  if (d === "accepted") return "Accepted";
  if (d === "declined") return "Declined";
  if (d === "expired") return "Expired";
  return d;
}

function EstimateTable({ rows }: { rows: EstimateListRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No estimates in this section.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-4 py-2 font-semibold text-zinc-700">Estimate</th>
            <th className="px-4 py-2 font-semibold text-zinc-700">Customer</th>
            <th className="px-4 py-2 font-semibold text-zinc-700">Status</th>
            <th className="px-4 py-2 font-semibold text-zinc-700">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-3">
                <Link
                  href={`/estimates/${e.id}`}
                  className="font-medium text-[#2436BB] hover:underline"
                >
                  {e.estimate_number || `Estimate ${e.id.slice(0, 8)}`}
                </Link>
                <div className="text-zinc-600">{e.title}</div>
              </td>
              <td className="px-4 py-3 text-zinc-700">
                {e.customer?.full_name ?? "—"}
                {e.customer?.email ? (
                  <div className="text-xs text-zinc-500">{e.customer.email}</div>
                ) : null}
              </td>
              <td className="px-4 py-3">{statusPill(displayLabel(e))}</td>
              <td className="px-4 py-3 text-zinc-600">
                {formatDateEastern(e.created_at, { dateStyle: "medium" })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function EstimatesListPage() {
  const rows = await getEstimatesList();
  const drafts = rows.filter((e) => bucket(e) === "draft");
  const sent = rows.filter((e) => bucket(e) === "sent");
  const awaiting = rows.filter((e) => bucket(e) === "awaiting");
  const accepted = rows.filter((e) => bucket(e) === "accepted");
  const declined = rows.filter((e) => bucket(e) === "declined");
  const expired = rows.filter((e) => bucket(e) === "expired");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Estimates</h1>
          <p className="mt-1 text-zinc-600">
            Create and send quotes before a job exists. Customers can accept or decline from a
            secure link.
          </p>
        </div>
        <Link
          href="/estimates/create"
          className="inline-flex items-center justify-center rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96]"
        >
          New estimate
        </Link>
      </div>

      <Section title="Draft" description="Not yet emailed to the customer." rows={drafts} />
      <Section title="Sent" description="Delivered; customer has not opened the link yet." rows={sent} />
      <Section
        title="Awaiting response"
        description="Customer opened the estimate but has not accepted or declined."
        rows={awaiting}
      />
      <Section title="Accepted" description="Ready to convert into a job." rows={accepted} />
      <Section title="Declined" description="Customer declined this quote." rows={declined} />
      <Section title="Expired" description="Past the valid-until date while still open." rows={expired} />

      {rows.length === 0 && (
        <p className="text-sm text-zinc-600">
          No estimates yet.{" "}
          <Link href="/estimates/create" className="font-medium text-[#2436BB] hover:underline">
            Create your first estimate
          </Link>
        </p>
      )}
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
  rows: EstimateListRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
      <div className="mt-3">
        <EstimateTable rows={rows} />
      </div>
    </section>
  );
}
