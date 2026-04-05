import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob, getInvoices, getProfile, getContractForJob } from "@/app/(app)/actions";
import { formatDateEastern, formatDateTimeEastern } from "@/lib/datetime-eastern";
import {
  invoiceCustomerViewSecondaryLine,
  invoiceStatusesWhereCustomerViewApplies,
} from "@/lib/invoice-viewed-display";
import { InvoiceBuilderForm, type LatestInvoiceSummary } from "./invoice-builder-form";
import {
  InvoicePageNotices,
  type InvoicePageNoticeKind,
} from "./invoice-page-notices";

function firstSearchParam(
  v: string | string[] | undefined
): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export default async function InvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { jobId } = await params;
  const sp = searchParams ? await searchParams : {};
  const jobCompletedFlag = sp.jobCompleted;
  const showJobCompletedMessage =
    jobCompletedFlag === "1" ||
    jobCompletedFlag === "true" ||
    (Array.isArray(jobCompletedFlag) &&
      (jobCompletedFlag[0] === "1" || jobCompletedFlag[0] === "true"));

  const rawNotice = firstSearchParam(sp.invNotice);
  const invoiceNotice: InvoicePageNoticeKind =
    rawNotice === "sent" ||
    rawNotice === "resent" ||
    rawNotice === "draft" ||
    rawNotice === "failed"
      ? rawNotice
      : null;
  const rawMsg = firstSearchParam(sp.invMsg)?.trim();
  const invoiceNoticeMsg = rawMsg ? safeDecodeURIComponent(rawMsg) : null;

  const [job, invoices, profile, contract] = await Promise.all([
    getJob(jobId),
    getInvoices(jobId),
    getProfile(),
    getContractForJob(jobId),
  ]);

  if (!job) notFound();

  const contractSigned = contract?.status === "signed";

  const latestInvoice: LatestInvoiceSummary | null =
    invoices.length > 0
      ? (() => {
          const inv = invoices[0] as LatestInvoiceSummary;
          return {
            id: inv.id,
            invoice_number: inv.invoice_number,
            subtotal: Number(inv.subtotal),
            tax_amount: Number(inv.tax_amount),
            total: Number(inv.total),
            deposit_credited: inv.deposit_credited != null ? Number(inv.deposit_credited) : null,
            balance_due: inv.balance_due != null ? Number(inv.balance_due) : null,
            due_date: inv.due_date,
            status: inv.status,
          };
        })()
      : null;

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  const businessName = (profile as { business_name?: string | null })?.business_name;
  const contractorAddress = profile
    ? [profile.address_line_1, profile.address_line_2, profile.city, profile.province, profile.postal_code]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href={`/jobs/${jobId}`}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Back to job
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Invoices</h1>
        <p className="mt-1 text-zinc-600">
          {job.title} • {customer?.full_name ?? "Unknown customer"}
        </p>
      </div>

      <InvoicePageNotices
        jobId={jobId}
        notice={invoiceNotice}
        message={invoiceNoticeMsg}
      />

      {businessName && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
          <p className="text-sm font-medium text-zinc-900">{businessName}</p>
          {(profile?.phone || contractorAddress) && (
            <p className="mt-1 text-sm text-zinc-600">
              {[profile?.phone, contractorAddress].filter(Boolean).join(" • ")}
            </p>
          )}
        </div>
      )}

      {showJobCompletedMessage && invoices.length === 0 && (
        <div
          className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-950"
          role="status"
        >
          <p className="font-semibold text-green-900">Job marked complete.</p>
          <p className="mt-1 text-green-900">Create your invoice now.</p>
        </div>
      )}

      <InvoiceBuilderForm
        jobId={jobId}
        job={job}
        contractSigned={contractSigned}
        latestInvoice={latestInvoice}
      />

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold text-zinc-900 sm:px-6">
          Invoice history
        </h2>
        <div className="divide-y divide-zinc-200">
          {invoices.length === 0 ? (
            <div className="px-4 py-12 text-center text-zinc-500 sm:px-6">
              No invoices yet. Create one above.
            </div>
          ) : (
            invoices.map(
              (inv: {
                id: string;
                invoice_number: string | null;
                total: number;
                balance_due?: number | null;
                status: string;
                created_at: string;
                sent_at?: string | null;
                viewed_at?: string | null;
              }) => {
                const displayAmount =
                  inv.balance_due != null && inv.balance_due !== undefined
                    ? Number(inv.balance_due)
                    : Number(inv.total);
                const customerViewLine = invoiceCustomerViewSecondaryLine({
                  viewedAt: inv.viewed_at,
                  showNotYetViewed: invoiceStatusesWhereCustomerViewApplies(inv.status),
                  invoiceStatus: inv.status,
                });
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-4 py-4 sm:px-6"
                  >
                    <div>
                      <p className="font-medium text-zinc-900">
                        {inv.invoice_number ?? `Invoice ${inv.id.slice(0, 8)}`}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {inv.sent_at
                          ? `Issued ${formatDateTimeEastern(inv.sent_at)}`
                          : `Created ${formatDateEastern(inv.created_at)}`}
                        {" "}
                        •{" "}
                        <span
                          className={
                            inv.status === "paid"
                              ? "text-green-700"
                              : inv.status === "sent"
                                ? "text-amber-700"
                                : inv.status === "overdue"
                                  ? "text-red-700"
                                  : "text-zinc-600"
                          }
                        >
                          {inv.status}
                        </span>
                      </p>
                      {customerViewLine && (
                        <p className="mt-0.5 text-xs text-zinc-500">{customerViewLine}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-zinc-900">
                        ${displayAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      {inv.balance_due != null &&
                        inv.balance_due !== undefined &&
                        Number(inv.balance_due) !== Number(inv.total) && (
                          <p className="text-xs text-zinc-500">Balance due</p>
                        )}
                    </div>
                  </div>
                );
              }
            )
          )}
        </div>
      </div>
    </div>
  );
}
