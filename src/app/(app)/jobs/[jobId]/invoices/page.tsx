import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob, getInvoices, getProfile } from "@/app/(app)/actions";
import { InvoiceBuilderForm } from "./invoice-builder-form";

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const [job, invoices, profile] = await Promise.all([
    getJob(jobId),
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

      <InvoiceBuilderForm jobId={jobId} job={job} />

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
            invoices.map((inv: { id: string; invoice_number: string | null; total: number; status: string; created_at: string }) => (
              <div
                key={inv.id}
                className="flex items-center justify-between px-4 py-4 sm:px-6"
              >
                <div>
                  <p className="font-medium text-zinc-900">
                    {inv.invoice_number ?? `Invoice ${inv.id.slice(0, 8)}`}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {new Date(inv.created_at).toLocaleDateString()} •{" "}
                    <span
                      className={
                        inv.status === "paid"
                          ? "text-green-700"
                          : inv.status === "sent"
                            ? "text-amber-700"
                            : "text-zinc-600"
                      }
                    >
                      {inv.status}
                    </span>
                  </p>
                </div>
                <p className="font-medium text-zinc-900">${Number(inv.total).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
