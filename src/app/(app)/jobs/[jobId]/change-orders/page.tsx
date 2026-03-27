import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob, getChangeOrders } from "@/app/(app)/actions";
import { AddChangeOrderForm } from "./add-change-order-form";
import { ChangeOrderActions } from "./change-order-actions";
import { formatChangeOrderSentDelivery } from "@/lib/change-order-display";

export default async function ChangeOrdersPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const [job, changeOrders] = await Promise.all([
    getJob(jobId),
    getChangeOrders(jobId),
  ]);

  if (!job) notFound();

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;

  const signedTotal = changeOrders
    .filter((c: { status: string }) => c.status === "signed")
    .reduce((s: number, c: { change_amount?: number | null }) => s + (c.change_amount ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href={`/jobs/${jobId}`}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Back to job
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Change orders</h1>
        <p className="mt-1 text-zinc-600">
          {job.title} • Contract: ${(job.original_contract_price ?? 0).toLocaleString()}
          {signedTotal !== 0 && (
            <span className="text-green-700">
              {" "}+ ${signedTotal.toLocaleString()} signed changes = ${Number(job.current_contract_total ?? job.original_contract_price ?? 0).toLocaleString()} total
            </span>
          )}
        </p>
      </div>

      <AddChangeOrderForm
        jobId={jobId}
        job={job}
        customerEmail={customer?.email}
        jobEditLocked={job.contract_status === "signed"}
      />

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold text-zinc-900 sm:px-6">
          Change orders
        </h2>
        <div className="divide-y divide-zinc-200">
          {changeOrders.length === 0 ? (
            <div className="px-4 py-12 text-center text-zinc-500 sm:px-6">
              No change orders yet. Add one above to save a draft or send for customer approval.
            </div>
          ) : (
            changeOrders.map((co: {
              id: string;
              change_title: string | null;
              change_amount: number | null;
              revised_total_price: number | null;
              original_contract_price: number | null;
              status: string;
              signed_at: string | null;
              signing_method: string | null;
              created_at: string;
              sent_at: string | null;
              sent_delivery_method: string | null;
            }) => {
              const statusLabel =
                co.status === "sent"
                  ? "Awaiting customer approval"
                  : co.status === "signed"
                    ? "Signed"
                    : co.status === "declined"
                      ? "Declined"
                      : co.status === "draft"
                        ? "Draft"
                        : co.status;
              const prev = co.original_contract_price ?? 0;
              const next = co.revised_total_price ?? prev + (co.change_amount ?? 0);
              const delta = co.change_amount ?? next - prev;
              return (
              <div key={co.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <p className="font-medium text-zinc-900">{co.change_title ?? "Change order"}</p>
                  <p className="text-sm text-zinc-500">
                    {new Date(co.created_at).toLocaleDateString()} •{" "}
                    <span
                      className={
                        co.status === "signed"
                          ? "text-green-700"
                          : co.status === "declined"
                            ? "text-red-700"
                            : co.status === "sent"
                              ? "text-amber-700"
                              : "text-zinc-600"
                      }
                    >
                      {statusLabel}
                    </span>
                    {co.signed_at && co.signing_method && (
                      <span className="ml-1 text-zinc-500">
                        • {new Date(co.signed_at).toLocaleDateString()} ({co.signing_method})
                      </span>
                    )}
                  </p>
                  {co.status === "sent" && co.sent_at && (
                    <p className="mt-1 text-xs text-zinc-600">
                      Sent {new Date(co.sent_at).toLocaleString()} •{" "}
                      {formatChangeOrderSentDelivery(co.sent_delivery_method)}
                    </p>
                  )}
                  {co.revised_total_price != null && (
                    <p className="mt-0.5 text-sm text-zinc-600">
                      ${prev.toLocaleString()} → ${next.toLocaleString()}
                      <span className={delta >= 0 ? " text-green-700" : " text-red-700"}>
                        {" "}
                        ({delta >= 0 ? "+" : ""}
                        {delta.toLocaleString()})
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <ChangeOrderActions
                    changeOrder={co}
                    jobId={jobId}
                    customerEmail={customer?.email}
                  />
                </div>
              </div>
            );
            })
          )}
        </div>
      </div>
    </div>
  );
}
