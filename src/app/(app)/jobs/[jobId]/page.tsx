import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBusinessProfileCompleteForApp } from "@/lib/validation/business-profile";
import {
  getJob,
  getJobUpdatesWithSignedAttachmentUrls,
  getContractForJob,
  getChangeOrders,
  getProfile,
  getInvoiceDeliverySummaryForJobIds,
} from "../../actions";
import { isJobLockedForContractEdits } from "@/lib/job-contract-lock";
import { getCompletedJobInvoiceUi } from "@/lib/completed-job-invoice-ui";
import {
  EMPTY_JOB_OUTSTANDING,
  getJobOutstandingIndicators,
  getJobPrimaryLifecycleStatus,
  outstandingIndicatorLinkClassName,
} from "@/lib/job-dashboard-status";
import {
  formatDateEastern,
  formatDateTimeEastern,
  formatLocalDateStringEastern,
} from "@/lib/datetime-eastern";
import { MarkJobCompleteButton } from "./mark-job-complete-button";
import { UpdateTimelinePhotos } from "./update-timeline-photos";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { jobId } = await params;
  const sp = searchParams ? await searchParams : {};
  const contractSentFlag = sp.contractSent;
  const contractSent =
    contractSentFlag === "1" ||
    contractSentFlag === "true" ||
    (Array.isArray(contractSentFlag) &&
      (contractSentFlag[0] === "1" || contractSentFlag[0] === "true"));
  const rawEmail = sp.contractEmail;
  const contractEmailParam =
    typeof rawEmail === "string"
      ? rawEmail
      : Array.isArray(rawEmail)
        ? rawEmail[0]
        : undefined;
  let contractEmailDisplay = "";
  if (contractEmailParam) {
    try {
      contractEmailDisplay = decodeURIComponent(contractEmailParam);
    } catch {
      contractEmailDisplay = contractEmailParam;
    }
  }
  const [job, updates, contract, changeOrders, profile, supabase] = await Promise.all([
    getJob(jobId),
    getJobUpdatesWithSignedAttachmentUrls(jobId),
    getContractForJob(jobId),
    getChangeOrders(jobId),
    getProfile(),
    createClient(),
  ]);

  if (!job) notFound();

  const invSummary = await getInvoiceDeliverySummaryForJobIds([jobId]);
  const invFlags = invSummary[jobId] ?? EMPTY_JOB_OUTSTANDING;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  const businessIncomplete =
    !profile ||
    !user ||
    !isBusinessProfileCompleteForApp({
      business_name: profile.business_name,
      account_email: user.email ?? "",
      phone: profile.phone,
      address_line_1: profile.address_line_1,
      city: profile.city,
      province: profile.province,
      postal_code: profile.postal_code,
    });

  const primaryStatus = getJobPrimaryLifecycleStatus(job);
  const outstandingIndicators = getJobOutstandingIndicators(jobId, job, invFlags);
  const completedInvoiceUi =
    job.status === "completed" && job.contract_status === "signed"
      ? getCompletedJobInvoiceUi(jobId, invFlags)
      : null;

  return (
    <div className="space-y-6">
      {contractSent && (
        <div
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-950"
          role="status"
        >
          <p className="font-semibold text-green-900">Contract sent for signature</p>
          {contractEmailDisplay ? (
            <p className="mt-1 text-green-900">
              Contract sent to <span className="font-medium">{contractEmailDisplay}</span> for
              signature.
            </p>
          ) : (
            <p className="mt-1 text-green-800">
              A remote signing link was created. If you don&apos;t see this message with an email
              address, check the contract page and your email provider logs.
            </p>
          )}
        </div>
      )}
      {businessIncomplete && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Complete your business profile to send contracts and invoices.{" "}
          <Link href="/settings/business" className="font-medium underline hover:no-underline">
            Add business details →
          </Link>
        </div>
      )}
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Back to dashboard
        </Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
              {job.title}
            </h1>
            <p className="mt-1 text-zinc-600">
              {customer?.full_name ?? "Unknown customer"}
              {customer?.email && (
                <span className="ml-2 text-zinc-500">• {customer.email}</span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${primaryStatus.badgeClass}`}
              >
                {primaryStatus.label}
              </span>
              {outstandingIndicators.length > 0 && (
                <ul
                  className="contents m-0 list-none p-0"
                  aria-label="Outstanding actions for this job"
                >
                  {outstandingIndicators.map((ind) => (
                    <li key={ind.id} className="inline">
                      <Link
                        href={ind.href}
                        aria-label={ind.ariaLabel}
                        className={`${outstandingIndicatorLinkClassName} ${ind.badgeClass}`}
                      >
                        {ind.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {(job.current_contract_total ?? job.original_contract_price) != null && (
                <span className="text-sm font-medium text-zinc-700">
                  ${Number(job.current_contract_total ?? job.original_contract_price).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isJobLockedForContractEdits(job.contract_status) && (
              <Link
                href={`/jobs/${jobId}/edit`}
                className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
              >
                Edit job
              </Link>
            )}
            <Link
              href={`/jobs/${jobId}/updates/new`}
              className="rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2"
            >
              Add job update (photos/notes)
            </Link>
            <Link
              href={`/jobs/${jobId}/contract`}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
            >
              {job.contract_status === "signed"
                ? "View contract"
                : job.contract_status === "pending"
                  ? "Contract (pending)"
                  : "Create contract"}
            </Link>
            <Link
              href={`/jobs/${jobId}/change-orders`}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
            >
              Add change order
            </Link>
            <Link
              href={`/jobs/${jobId}/invoices`}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
            >
              Invoices
            </Link>
            <Link
              href={`/jobs/${jobId}/proof`}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
            >
              Proof report
            </Link>
            {job.status === "active" && <MarkJobCompleteButton jobId={jobId} />}
          </div>
          {isJobLockedForContractEdits(job.contract_status) && (
            <p className="mt-3 max-w-2xl text-sm text-zinc-600">
              This job is locked because the contract has been signed. Customer, property, title,
              scope, price, and schedule cannot be changed here — use change orders to amend the
              agreement.
            </p>
          )}
          {completedInvoiceUi && (
            <div className="w-full border-t border-zinc-100 pt-4">
              <div className="rounded-lg border border-[#2436BB]/25 bg-[#2436BB]/5 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 gap-y-1.5">
                  <p className="font-medium text-zinc-900">Invoicing</p>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${completedInvoiceUi.statusBadgeClass}`}
                  >
                    {completedInvoiceUi.statusLabel}
                  </span>
                </div>
                {completedInvoiceUi.billingDetailLine && (
                  <p className="mt-1.5 text-sm font-medium text-zinc-800">
                    {completedInvoiceUi.billingDetailLine}
                  </p>
                )}
                <p className="mt-2 text-zinc-600">
                  {completedInvoiceUi.statusKind === "overdue"
                    ? "This invoice is past due. Follow up with the customer or resend if they need another copy."
                    : completedInvoiceUi.statusKind === "paid"
                      ? "Payment has been recorded. Use the button below if the customer needs another copy."
                      : completedInvoiceUi.statusKind === "sent"
                        ? "This invoice has been sent to the customer. Use the button below if they need another copy."
                        : completedInvoiceUi.statusKind === "draft"
                          ? "You have a draft saved — open Invoices to review details and send it when you’re ready."
                          : "No invoice has been sent yet. Create one from the agreed contract total."}
                </p>
                <Link
                  href={completedInvoiceUi.invoicesHref}
                  aria-label={`${completedInvoiceUi.actionLabel} for this job`}
                  className="mt-3 inline-flex rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2436BB]"
                >
                  {completedInvoiceUi.actionLabel}
                </Link>
              </div>
            </div>
          )}
        </div>

        {!contract && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Create a contract before starting work
          </div>
        )}
        {contract?.status === "signed" && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
            <h2 className="font-semibold text-zinc-900">Contract</h2>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <span className="text-zinc-600">
                Status: <span className="font-medium text-green-700">Signed</span>
              </span>
              {contract.signed_at && (
                <span className="text-zinc-600">
                  Signed: {formatDateEastern(contract.signed_at)}
                </span>
              )}
              {contract.price != null && (
                <span className="text-zinc-600">
                  Price: ${Number(contract.price).toLocaleString()}
                </span>
              )}
              {contract.signing_method && (
                <span className="text-zinc-600 capitalize">
                  Method: {contract.signing_method}
                </span>
              )}
            </div>
            <Link
              href={`/jobs/${jobId}/contract`}
              className="mt-3 inline-block text-sm font-medium text-[#2436BB] hover:underline"
            >
              View signed contract
            </Link>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
          <h2 className="font-semibold text-zinc-900">Change orders</h2>
          {changeOrders.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-600">No change orders yet.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-zinc-600">
                Signed total: ${changeOrders
                  .filter((c: { status: string }) => c.status === "signed")
                  .reduce((s: number, c: { change_amount?: number | null }) => s + (c.change_amount ?? 0), 0)
                  .toLocaleString()}
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                {changeOrders.slice(0, 5).map((co: {
                  id: string;
                  change_title: string | null;
                  change_amount: number | null;
                  revised_total_price: number | null;
                  original_contract_price: number | null;
                  status: string;
                  signed_at: string | null;
                  signing_method: string | null;
                  pdf_path: string | null;
                }) => {
                  const prev = co.original_contract_price ?? 0;
                  const next = co.revised_total_price ?? prev + (co.change_amount ?? 0);
                  const delta = co.change_amount ?? next - prev;
                  return (
                  <li key={co.id} className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-zinc-900">
                        {co.change_title ?? "Change order"}
                      </span>
                      <span className={`ml-2 ${co.status === "signed" ? "text-green-700" : co.status === "declined" ? "text-red-700" : co.status === "sent" ? "text-amber-700" : "text-zinc-500"}`}>
                        ({co.status === "sent" ? "awaiting approval" : co.status})
                      </span>
                      {co.revised_total_price != null && (
                        <span className="ml-2 text-zinc-600">
                          ${prev.toLocaleString()} → ${next.toLocaleString()}
                          <span className={delta >= 0 ? " text-green-700" : " text-red-700"}>
                            {" "}({delta >= 0 ? "+" : ""}{delta.toLocaleString()})
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {co.signed_at && (
                        <span className="text-zinc-500">
                          {formatDateEastern(co.signed_at)}
                          {co.signing_method && ` (${co.signing_method})`}
                        </span>
                      )}
                      {co.status === "signed" && (
                        <Link
                          href={`/jobs/${jobId}/change-orders/${co.id}`}
                          className="text-sm font-medium text-[#2436BB] hover:underline"
                        >
                          {co.pdf_path ? "View PDF" : "View"}
                        </Link>
                      )}
                    </div>
                  </li>
                );
                })}
              </ul>
            </>
          )}
          <Link
            href={`/jobs/${jobId}/change-orders`}
            className="mt-2 inline-block text-sm font-medium text-[#2436BB] hover:underline"
          >
            View change orders
          </Link>
        </div>

        {(job.property_address_line_1 || job.description) && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
            {job.property_address_line_1 && (
              <p className="text-sm text-zinc-600">
                <span className="font-medium text-zinc-700">Address:</span>{" "}
                {[job.property_address_line_1, job.property_address_line_2, job.property_city, job.property_province, job.property_postal_code]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            {job.description && (
              <p className="mt-2 text-sm text-zinc-600">
                <span className="font-medium text-zinc-700">Description:</span>{" "}
                {job.description}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold text-zinc-900 sm:px-6">
          Timeline
        </h2>
        <div className="divide-y divide-zinc-200">
          {updates.length === 0 ? (
            <div className="px-4 py-12 text-center text-zinc-500 sm:px-6">
              <p>No updates yet.</p>
              <Link
                href={`/jobs/${jobId}/updates/new`}
                className="mt-2 inline-block font-medium text-[#2436BB] hover:underline"
              >
                Add first update
              </Link>
            </div>
          ) : (
            updates.map(
              (update: {
                id: string;
                category: string;
                title: string;
                note: string | null;
                date: string;
                created_at: string;
                location_source?: string | null;
                location_latitude?: number | null;
                location_longitude?: number | null;
                job_update_attachments: {
                  id: string;
                  file_name: string;
                  file_type: string | null;
                  mime_type?: string | null;
                  captured_at: string | null;
                  signedUrl?: string | null;
                }[];
              }) => {
                const atts = update.job_update_attachments ?? [];
                const n = atts.length;
                const photoCount = atts.filter((a) => a.file_type === "photo").length;
                const docTime = formatDateTimeEastern(update.created_at);
                const hasRecordedLocation =
                  update.location_source === "device_current" &&
                  update.location_latitude != null &&
                  update.location_longitude != null;

                const isTimelineImage = (a: (typeof atts)[number]) => {
                  if (!a.signedUrl) return false;
                  if (a.file_type === "photo") return true;
                  if (a.mime_type?.toLowerCase().startsWith("image/")) return true;
                  return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(a.file_name);
                };

                const photoTiles = atts
                  .filter(isTimelineImage)
                  .map((a) => ({
                    id: a.id,
                    file_name: a.file_name,
                    signedUrl: a.signedUrl ?? null,
                  }));
                const photoTileIds = new Set(photoTiles.map((p) => p.id));
                const otherAttachments = atts.filter((a) => !photoTileIds.has(a.id));

                return (
                <div
                  key={update.id}
                  className="px-4 py-4 sm:px-6"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium capitalize text-zinc-700">
                        {update.category}
                      </span>
                      <h3 className="mt-1 text-base font-semibold text-zinc-900">
                        {update.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-zinc-600">
                        Job date {formatLocalDateStringEastern(update.date)}
                        {n > 0 && (
                          <>
                            {" "}
                            · {n} attachment{n === 1 ? "" : "s"}
                            {photoCount > 0 && (
                              <>
                                {" "}
                                ({photoCount} photo{photoCount === 1 ? "" : "s"})
                              </>
                            )}
                          </>
                        )}
                      </p>
                      {update.note && (
                        <p className="mt-1 text-sm text-zinc-600">{update.note}</p>
                      )}
                      <p className="mt-1 text-xs text-zinc-500">
                        Documented {docTime}
                      </p>
                      {hasRecordedLocation && photoCount > 0 && (
                        <p className="mt-1 text-xs font-medium text-zinc-700">
                          Location recorded
                        </p>
                      )}
                      <UpdateTimelinePhotos attachments={photoTiles} />
                      {photoTiles.length > 0 && (
                        <p className="mt-2 text-xs text-zinc-500">
                          Tap a thumbnail to view full size.
                        </p>
                      )}
                    </div>
                    {otherAttachments.length > 0 && (
                      <div className="mt-2 flex min-w-0 flex-col gap-1 sm:mt-0 sm:max-w-[14rem]">
                        <p className="text-xs font-medium text-zinc-600">Other files</p>
                        <div className="flex flex-wrap gap-1">
                          {otherAttachments.map((a) => (
                            <span
                              key={a.id}
                              className="inline-flex max-w-full items-center truncate rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600"
                              title={
                                a.captured_at
                                  ? `Uploaded ${formatDateTimeEastern(a.captured_at)}`
                                  : a.file_name
                              }
                            >
                              📎 {a.file_name}
                            </span>
                          ))}
                        </div>
                      </div>
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
