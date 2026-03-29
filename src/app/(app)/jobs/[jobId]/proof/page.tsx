import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getJob,
  getJobUpdatesWithSignedAttachmentUrls,
  getContractForJob,
  getChangeOrders,
  getInvoices,
  getProfile,
} from "@/app/(app)/actions";
import { ProofPhotoEvidence } from "./proof-photo-evidence";
import {
  formatDateEastern,
  formatDateTimeEastern,
  formatLocalDateStringEastern,
} from "@/lib/datetime-eastern";

export default async function ProofReportPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const [job, updates, contract, changeOrders, invoices, profile] = await Promise.all([
    getJob(jobId),
    getJobUpdatesWithSignedAttachmentUrls(jobId),
    getContractForJob(jobId),
    getChangeOrders(jobId),
    getInvoices(jobId),
    getProfile(),
  ]);

  if (!job) notFound();

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  const businessName = (profile as { business_name?: string | null })?.business_name;
  const contractorAddress = profile
    ? [profile.address_line_1, profile.address_line_2, profile.city, profile.province, profile.postal_code]
        .filter(Boolean)
        .join(", ")
    : "";
  const signedChanges = changeOrders.filter((c: { status: string }) => c.status === "signed");
  const signedChangeTotal = signedChanges.reduce(
    (s: number, c: { change_amount?: number | null }) => s + (c.change_amount ?? 0),
    0
  );

  const attachmentCount = updates.reduce(
    (sum: number, u: { job_update_attachments?: { id: string }[] }) =>
      sum + (u.job_update_attachments?.length ?? 0),
    0
  );

  const isEvidenceImage = (a: {
    signedUrl?: string | null;
    file_type?: string | null;
    mime_type?: string | null;
    file_name: string;
  }) => {
    if (!a.signedUrl) return false;
    if (a.file_type === "photo") return true;
    if (a.mime_type?.toLowerCase().startsWith("image/")) return true;
    return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(a.file_name);
  };

  type ProofAtt = {
    id: string;
    file_name: string;
    file_type: string | null;
    mime_type?: string | null;
    signedUrl?: string | null;
  };
  type ProofUpdate = { title: string; date: string; job_update_attachments?: ProofAtt[] };

  const evidencePhotos: { id: string; file_name: string; signedUrl: string | null }[] = [];
  for (const u of updates as ProofUpdate[]) {
    for (const a of u.job_update_attachments ?? []) {
      if (isEvidenceImage(a)) {
        evidencePhotos.push({
          id: a.id,
          file_name: `${u.title} · ${formatLocalDateStringEastern(u.date)} · ${a.file_name}`,
          signedUrl: a.signedUrl ?? null,
        });
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link
          href={`/jobs/${jobId}`}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Back to job
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Proof report</h1>
        <p className="mt-1 text-zinc-600">
          {job.title} • {customer?.full_name ?? "Unknown customer"}
        </p>
      </div>

      <div className="space-y-6">
        {/* Contractor information */}
        {(businessName || profile?.phone || contractorAddress) && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="font-semibold text-zinc-900">Contractor</h2>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {businessName && (
                <div>
                  <dt className="text-sm text-zinc-500">Business</dt>
                  <dd className="font-medium text-zinc-900">{businessName}</dd>
                </div>
              )}
              {profile?.phone && (
                <div>
                  <dt className="text-sm text-zinc-500">Phone</dt>
                  <dd className="font-medium text-zinc-900">{profile.phone}</dd>
                </div>
              )}
              {contractorAddress && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-zinc-500">Address</dt>
                  <dd className="font-medium text-zinc-900">{contractorAddress}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Job summary */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="font-semibold text-zinc-900">Job summary</h2>
          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-zinc-500">Customer</dt>
              <dd className="font-medium text-zinc-900">{customer?.full_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Property address</dt>
              <dd className="font-medium text-zinc-900">
                {[job.property_address_line_1, job.property_city, job.property_province]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Original contract</dt>
              <dd className="font-medium text-zinc-900">
                ${(job.original_contract_price ?? 0).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Signed change orders</dt>
              <dd className="font-medium text-zinc-900">
                ${signedChangeTotal.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Current total</dt>
              <dd className="font-medium text-zinc-900">
                ${(job.current_contract_total ?? job.original_contract_price ?? 0).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Contract status</dt>
              <dd className="font-medium text-zinc-900">{job.contract_status ?? "—"}</dd>
            </div>
          </dl>
        </div>

        {/* Signed contract */}
        {contract?.status === "signed" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="font-semibold text-zinc-900">Signed contract</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Signed{" "}
              {contract.signed_at
                ? formatDateTimeEastern(contract.signed_at)
                : "—"}{" "}
              ({contract.signing_method ?? "—"})
            </p>
            {contract.signer_name && (
              <p className="mt-1 text-sm text-zinc-600">By: {contract.signer_name}</p>
            )}
            <Link
              href={`/jobs/${jobId}/contract`}
              className="mt-3 inline-block text-sm font-medium text-[#2436BB] hover:underline"
            >
              View contract
            </Link>
          </div>
        )}

        {/* Signed change orders */}
        {signedChanges.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="font-semibold text-zinc-900">Signed change orders</h2>
            <ul className="mt-4 space-y-2">
              {signedChanges.map((co: {
                id: string;
                change_title: string | null;
                change_amount: number | null;
                revised_total_price: number | null;
                original_contract_price: number | null;
                signed_at: string | null;
                signing_method: string | null;
              }) => {
                const prev = co.original_contract_price ?? 0;
                const next = co.revised_total_price ?? prev + (co.change_amount ?? 0);
                const delta = co.change_amount ?? next - prev;
                return (
                <li key={co.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-zinc-900">
                      {co.change_title ?? "Change order"}
                    </span>
                    <span className="ml-2 text-zinc-500">
                      ${prev.toLocaleString()} → ${next.toLocaleString()}
                      <span className={delta >= 0 ? " text-green-700" : " text-red-700"}>
                        {" "}({delta >= 0 ? "+" : ""}{delta.toLocaleString()})
                      </span>
                    </span>
                    {co.signed_at && co.signing_method && (
                      <span className="ml-2 text-zinc-400">
                        • {formatDateEastern(co.signed_at)} ({co.signing_method})
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/jobs/${jobId}/change-orders/${co.id}`}
                    className="text-sm font-medium text-[#2436BB] hover:underline"
                  >
                    View
                  </Link>
                </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Timeline updates */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="font-semibold text-zinc-900">Timeline updates</h2>
          <p className="mt-2 text-sm text-zinc-600">
            {updates.length} update{updates.length !== 1 ? "s" : ""} recorded
          </p>
          <ul className="mt-4 space-y-4">
            {updates.slice(0, 10).map(
              (u: {
                id: string;
                category: string;
                title: string;
                date: string;
                note?: string | null;
                location_source?: string | null;
                location_latitude?: number | null;
                location_longitude?: number | null;
                location_accuracy_meters?: number | null;
                location_captured_at?: string | null;
                job_update_attachments?: {
                  file_type?: string | null;
                  mime_type?: string | null;
                  file_name?: string;
                  signedUrl?: string | null;
                }[];
              }) => {
                const atts = u.job_update_attachments ?? [];
                const n = atts.length;
                const photoCount = atts.filter((a) => a.file_type === "photo").length;
                const hasLoc =
                  u.location_source === "device_current" &&
                  u.location_latitude != null &&
                  u.location_longitude != null;
                return (
                  <li
                    key={u.id}
                    className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium capitalize text-zinc-700">
                        {u.category}
                      </span>
                      <span className="font-medium text-zinc-900">{u.title}</span>
                      <span className="text-zinc-500">
                        {formatLocalDateStringEastern(u.date)}
                      </span>
                    </div>
                    {u.note && <p className="mt-2 text-zinc-600">{u.note}</p>}
                    {n > 0 && (
                      <p className="mt-2 text-xs text-zinc-600">
                        {photoCount > 0 ? (
                          <>
                            {photoCount} photo{photoCount !== 1 ? "s" : ""} added
                            {n > photoCount &&
                              ` • ${n - photoCount} other attachment${n - photoCount !== 1 ? "s" : ""}`}
                          </>
                        ) : (
                          <>
                            {n} attachment{n !== 1 ? "s" : ""}
                          </>
                        )}
                      </p>
                    )}
                    {hasLoc && (
                      <div className="mt-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700">
                        <p className="font-semibold text-zinc-900">Location recorded for this update</p>
                        <p className="mt-1 text-zinc-600">
                          Current device location attached to this photo set.
                        </p>
                        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                          <div>
                            <dt className="text-zinc-500">Latitude</dt>
                            <dd className="font-mono text-zinc-900">{u.location_latitude}</dd>
                          </div>
                          <div>
                            <dt className="text-zinc-500">Longitude</dt>
                            <dd className="font-mono text-zinc-900">{u.location_longitude}</dd>
                          </div>
                          {u.location_captured_at && (
                            <div className="sm:col-span-2">
                              <dt className="text-zinc-500">Recorded at</dt>
                              <dd className="text-zinc-900">
                                {formatDateTimeEastern(u.location_captured_at)}
                              </dd>
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <dt className="text-zinc-500">Accuracy</dt>
                            <dd className="text-zinc-900">
                              {u.location_accuracy_meters != null &&
                              Number.isFinite(Number(u.location_accuracy_meters))
                                ? `±${Number(u.location_accuracy_meters).toLocaleString(undefined, { maximumFractionDigits: 0 })} m (typical GPS uncertainty)`
                                : "Not reported by device"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    )}
                  </li>
                );
              }
            )}
          </ul>
        </div>

        {/* Photo evidence */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="font-semibold text-zinc-900">Attachments / photo evidence</h2>
          <p className="mt-2 text-sm text-zinc-600">
            {attachmentCount > 0
              ? `${attachmentCount} attachment${attachmentCount !== 1 ? "s" : ""} across timeline updates`
              : "No attachments yet. Add photos to timeline updates."}
          </p>
          <ProofPhotoEvidence photos={evidencePhotos} />
        </div>

        {/* Invoice summary */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="font-semibold text-zinc-900">Invoice summary</h2>
          {invoices.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">No invoices yet.</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-zinc-600">
                {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
              </p>
              <ul className="mt-4 space-y-2">
                {invoices.map(
                  (inv: {
                    id: string;
                    invoice_number: string | null;
                    total: number;
                    balance_due?: number | null;
                    status: string;
                    sent_at?: string | null;
                    created_at: string;
                  }) => {
                    const amt =
                      inv.balance_due != null && inv.balance_due !== undefined
                        ? Number(inv.balance_due)
                        : Number(inv.total);
                    return (
                      <li key={inv.id} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:justify-between">
                        <span className="text-zinc-900">
                          {inv.invoice_number ?? `Invoice ${inv.id.slice(0, 8)}`}
                          {inv.sent_at && (
                            <span className="ml-2 text-zinc-500">
                              · Issued {formatDateTimeEastern(inv.sent_at)}
                            </span>
                          )}
                        </span>
                        <span className="font-medium text-zinc-900">
                          ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                          <span className="font-normal text-zinc-500">({inv.status})</span>
                        </span>
                      </li>
                    );
                  }
                )}
              </ul>
              <Link
                href={`/jobs/${jobId}/invoices`}
                className="mt-3 inline-block text-sm font-medium text-[#2436BB] hover:underline"
              >
                View invoices
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
