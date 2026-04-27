import Link from "next/link";
import { notFound } from "next/navigation";
import { resolvePublicAppOrigin } from "@/lib/app-origin";
import { formatDateEastern, formatLocalDateStringEastern } from "@/lib/datetime-eastern";
import { invoiceTaxShortLabel } from "@/lib/invoice-tax";
import { getCustomers, getProfile } from "@/app/(app)/actions";
import { getEstimateById } from "@/app/(app)/estimates/estimate-actions";
import { EstimateForm } from "@/app/(app)/estimates/estimate-form";
import {
  DuplicateEstimateButton,
  ResendEstimateEmailButton,
  SendEstimateButton,
} from "@/app/(app)/estimates/estimate-send-buttons";
import { defaultTaxRateForNewFinancials } from "@/lib/tax/canada";

export const dynamic = "force-dynamic";

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusLabel(display: string) {
  const map: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    viewed: "Awaiting response",
    accepted: "Accepted",
    declined: "Declined",
    expired: "Expired",
  };
  return map[display] ?? display;
}

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ estimateId: string }>;
}) {
  const { estimateId } = await params;
  const [estimate, customers, profile] = await Promise.all([
    getEstimateById(estimateId),
    getCustomers(),
    getProfile(),
  ]);
  if (!estimate) notFound();

  const initialTaxRate = String(
    defaultTaxRateForNewFinancials(profile?.province ?? null, null).taxRate
  );
  const taxLabel = invoiceTaxShortLabel(estimate.property_province);
  const publicUrl =
    estimate.public_token && estimate.status !== "draft"
      ? `${resolvePublicAppOrigin()}/estimate/${estimate.public_token}`
      : null;

  const isDraft = estimate.status === "draft";
  const canResend = ["sent", "viewed"].includes(estimate.status) || estimate.displayStatus === "expired";
  const showConvert =
    estimate.displayStatus === "accepted" && !estimate.job_id;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/estimates" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Estimates
        </Link>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
              {estimate.estimate_number || `Estimate ${estimate.id.slice(0, 8)}`}
            </h1>
            <p className="mt-1 text-zinc-600">{estimate.title}</p>
          </div>
          <p className="text-sm font-medium text-zinc-700">
            Status:{" "}
            <span className="rounded-full bg-zinc-100 px-2.5 py-1">
              {statusLabel(estimate.displayStatus)}
            </span>
          </p>
        </div>
      </div>

      {!isDraft && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          {estimate.displayStatus === "expired" && (
            <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50/95 px-4 py-4 sm:px-5">
              <h2 className="text-base font-semibold text-amber-950">This estimate has expired</h2>
              <p className="mt-1 text-sm text-amber-950/95">
                Send an updated version of this estimate to the customer.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
                <ResendEstimateEmailButton estimateId={estimate.id} prominent />
                <DuplicateEstimateButton estimateId={estimate.id} />
              </div>
            </div>
          )}
          <h2 className="text-lg font-semibold text-zinc-900">Summary</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Created</dt>
              <dd className="font-medium text-zinc-900">
                {formatDateEastern(estimate.created_at, { dateStyle: "long" })}
              </dd>
            </div>
            {estimate.expiry_date ? (
              <div>
                <dt className="text-zinc-500">Valid until (Eastern)</dt>
                <dd className="font-medium text-zinc-900">
                  {formatLocalDateStringEastern(estimate.expiry_date, { dateStyle: "long" })}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-zinc-500">Subtotal</dt>
              <dd className="font-medium tabular-nums text-zinc-900">${money(estimate.subtotal)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Tax ({taxLabel})</dt>
              <dd className="font-medium tabular-nums text-zinc-900">${money(estimate.tax_amount)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Total</dt>
              <dd className="font-semibold tabular-nums text-zinc-900">${money(estimate.total)}</dd>
            </div>
            {estimate.deposit_amount != null ? (
              <div>
                <dt className="text-zinc-500">Suggested deposit</dt>
                <dd className="font-medium tabular-nums text-zinc-900">${money(estimate.deposit_amount)}</dd>
              </div>
            ) : null}
          </dl>
          {estimate.customers ? (
            <div className="mt-4 border-t border-zinc-100 pt-4 text-sm">
              <p className="font-medium text-zinc-900">{estimate.customers.full_name}</p>
              {estimate.customers.email ? <p className="text-zinc-600">{estimate.customers.email}</p> : null}
              {estimate.customers.phone ? <p className="text-zinc-600">{estimate.customers.phone}</p> : null}
            </div>
          ) : null}
          {publicUrl ? (
            <div className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
              <p className="font-medium text-zinc-800">Customer link</p>
              <p className="mt-1 break-all text-zinc-600">{publicUrl}</p>
            </div>
          ) : null}
          {estimate.job_id ? (
            <p className="mt-4 text-sm text-zinc-600">
              Linked job:{" "}
              <Link href={`/jobs/${estimate.job_id}`} className="font-medium text-[#2436BB] hover:underline">
                Open job
              </Link>
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            {canResend && estimate.displayStatus !== "expired" ? (
              <ResendEstimateEmailButton estimateId={estimate.id} />
            ) : null}
            {showConvert ? (
              <Link
                href={`/estimates/${estimate.id}/convert`}
                className="inline-flex rounded-lg bg-[#2436BB] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96]"
              >
                Convert to job
              </Link>
            ) : null}
            {estimate.displayStatus === "accepted" && estimate.job_id ? (
              <Link
                href={`/jobs/${estimate.job_id}/contract`}
                className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Create contract from this job
              </Link>
            ) : null}
          </div>
        </div>
      )}

      {isDraft ? (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">Edit draft</h2>
          <EstimateForm
            customers={customers}
            profileProvince={profile?.province ?? null}
            initialTaxRate={initialTaxRate}
            mode="edit"
            estimateId={estimate.id}
            initial={estimate}
          />
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Send to customer</h2>
            <p className="mt-1 text-sm text-zinc-600">
              When you send, JobProof emails your customer a secure link. Complete your business
              profile in Settings if you have not already.
            </p>
            <div className="mt-4">
              <SendEstimateButton estimateId={estimate.id} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
