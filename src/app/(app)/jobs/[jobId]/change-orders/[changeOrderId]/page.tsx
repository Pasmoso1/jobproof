import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob, getChangeOrder, getChangeOrderDownloadUrl } from "@/app/(app)/actions";
import { ChangeOrderDownloadButton } from "./change-order-download-button";
import { ChangeOrderActions } from "../change-order-actions";
import { ChangeOrderWithdrawButton } from "../change-order-withdraw-button";
import { ChangeOrderDraftEditForm } from "./change-order-draft-edit-form";
import { formatChangeOrderSentDelivery } from "@/lib/change-order-display";

export default async function ChangeOrderDetailPage({
  params,
}: {
  params: Promise<{ jobId: string; changeOrderId: string }>;
}) {
  const { jobId, changeOrderId } = await params;
  const [job, changeOrder] = await Promise.all([
    getJob(jobId),
    getChangeOrder(changeOrderId),
  ]);

  if (!job || !changeOrder) notFound();
  if (changeOrder.job_id !== jobId) notFound();

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;

  const downloadUrl = changeOrder.pdf_path
    ? await getChangeOrderDownloadUrl(changeOrderId)
    : null;

  const original = changeOrder.original_contract_price ?? 0;
  const change = changeOrder.change_amount ?? 0;
  const revised = changeOrder.revised_total_price ?? original + change;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/jobs/${jobId}/change-orders`}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Back to change orders
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">
          {changeOrder.change_title ?? "Change order"}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          <span
            className={
              changeOrder.status === "signed"
                ? "text-green-700"
                : changeOrder.status === "declined"
                  ? "text-red-700"
                  : changeOrder.status === "sent"
                    ? "text-amber-700"
                    : "text-zinc-600"
            }
          >
            {changeOrder.status === "sent"
              ? "Awaiting customer approval"
              : changeOrder.status === "signed"
                ? "Signed"
                : changeOrder.status === "declined"
                  ? "Declined"
                  : changeOrder.status === "draft"
                    ? "Draft"
                    : changeOrder.status}
          </span>
          {changeOrder.signed_at && (
            <span className="ml-2 text-zinc-500">
              Signed {new Date(changeOrder.signed_at).toLocaleDateString()}
              {changeOrder.signing_method && ` via ${changeOrder.signing_method}`}
            </span>
          )}
        </p>
        {changeOrder.status === "sent" && changeOrder.sent_at && (
          <p className="mt-2 text-sm text-zinc-600">
            <span className="font-medium text-zinc-800">Sent for approval:</span>{" "}
            {new Date(changeOrder.sent_at).toLocaleString()} •{" "}
            <span className="font-medium text-zinc-800">Delivery:</span>{" "}
            {formatChangeOrderSentDelivery(changeOrder.sent_delivery_method)}
          </p>
        )}
      </div>

      {changeOrder.status === "sent" && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Awaiting customer approval</p>
          <p className="mt-1 text-amber-900/90">
            This change order can’t be edited while it’s sent. To change pricing, description, or
            dates, move it back to draft first (customer email links may stop working until you send
            again).
          </p>
          <div className="mt-3">
            <ChangeOrderWithdrawButton changeOrderId={changeOrderId} />
          </div>
        </div>
      )}

      <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6">
        {changeOrder.status === "draft" && (
          <ChangeOrderDraftEditForm changeOrder={changeOrder} />
        )}
        {changeOrder.status !== "draft" && changeOrder.change_description && (
          <div>
            <h2 className="text-sm font-medium text-zinc-500">Description</h2>
            <p className="mt-1 whitespace-pre-wrap text-zinc-900">
              {changeOrder.change_description}
            </p>
          </div>
        )}

        {changeOrder.status !== "draft" && changeOrder.reason_for_change && (
          <div>
            <h2 className="text-sm font-medium text-zinc-500">Reason for change</h2>
            <p className="mt-1 text-zinc-900">{changeOrder.reason_for_change}</p>
          </div>
        )}

        {changeOrder.status !== "draft" && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <h2 className="text-sm font-medium text-zinc-600">Job total (pricing)</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Previous job total → new job total after this change (difference shown).
          </p>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">Previous job total</span>
              <span className="font-medium text-zinc-900">${original.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">New job total</span>
              <span className="font-semibold text-[#2436BB]">${revised.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm">
              <span className="text-zinc-600">Change</span>
              <span className={`font-medium ${change >= 0 ? "text-green-700" : "text-red-700"}`}>
                {change >= 0 ? "+" : ""}${change.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
        )}

        {changeOrder.status !== "draft" &&
          (changeOrder.new_estimated_start_date || changeOrder.new_estimated_completion_date) && (
          <div>
            <h2 className="text-sm font-medium text-zinc-500">Schedule (this change)</h2>
            <dl className="mt-2 space-y-1 text-sm text-zinc-900">
              {changeOrder.new_estimated_start_date && (
                <div>
                  <dt className="text-zinc-500">Estimated start</dt>
                  <dd>{new Date(changeOrder.new_estimated_start_date).toLocaleDateString()}</dd>
                </div>
              )}
              {changeOrder.new_estimated_completion_date && (
                <div>
                  <dt className="text-zinc-500">Estimated completion</dt>
                  <dd>{new Date(changeOrder.new_estimated_completion_date).toLocaleDateString()}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {changeOrder.status !== "draft" && changeOrder.signed_at && (
          <div>
            <h2 className="text-sm font-medium text-zinc-500">Signing details</h2>
            <dl className="mt-2 space-y-1 text-sm">
              {changeOrder.signer_name && (
                <div>
                  <dt className="text-zinc-500">Signed by</dt>
                  <dd className="font-medium text-zinc-900">{changeOrder.signer_name}</dd>
                </div>
              )}
              {changeOrder.signer_email && (
                <div>
                  <dt className="text-zinc-500">Email</dt>
                  <dd className="text-zinc-900">{changeOrder.signer_email}</dd>
                </div>
              )}
              {changeOrder.signing_method && (
                <div>
                  <dt className="text-zinc-500">Method</dt>
                  <dd className="text-zinc-900 capitalize">{changeOrder.signing_method}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {downloadUrl && (
          <ChangeOrderDownloadButton url={downloadUrl} />
        )}

        {(changeOrder.status === "draft" || changeOrder.status === "sent") && (
          <div className="border-t border-zinc-200 pt-6">
            <h2 className="text-sm font-medium text-zinc-900">Next steps</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {changeOrder.status === "sent"
                ? "Customer can sign on your device or via the email link."
                : "Send for approval when ready, or sign on device / email the link."}
            </p>
            <div className="mt-4">
              <ChangeOrderActions
                changeOrder={changeOrder}
                jobId={jobId}
                customerEmail={customer?.email}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
