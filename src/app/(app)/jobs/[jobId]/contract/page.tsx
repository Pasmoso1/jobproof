import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ensureSignedContractPdf,
  getJob,
  getContractForJob,
  getContractPdfSignedUrl,
  getProfile,
} from "@/app/(app)/actions";
import { balanceDueOnCompletion } from "@/lib/contract-pricing-display";
import { formatDateEastern } from "@/lib/datetime-eastern";
import { ContractBuilderForm } from "./contract-builder-form";

export default async function ContractBuilderPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [job, contract, profile] = await Promise.all([
    getJob(jobId),
    getContractForJob(jobId),
    getProfile(),
  ]);

  if (!job) notFound();

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;

  if (contract?.status === "signed") {
    let displayContract = contract;
    if (!displayContract.pdf_path) {
      await ensureSignedContractPdf(displayContract.id);
      const refreshed = await getContractForJob(jobId);
      if (refreshed?.status === "signed") {
        displayContract = refreshed;
      }
    }
    const pdfUrl = displayContract.pdf_path
      ? await getContractPdfSignedUrl(displayContract.pdf_path)
      : null;

    const signedPrice =
      displayContract.price != null && Number(displayContract.price) > 0
        ? Number(displayContract.price)
        : null;
    const signedDeposit =
      displayContract.deposit_amount != null && Number(displayContract.deposit_amount) > 0
        ? Number(displayContract.deposit_amount)
        : null;
    const signedBalanceDue = balanceDueOnCompletion(signedPrice, signedDeposit);

    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link
            href={`/jobs/${jobId}`}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            ← Back to job
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900">Signed contract</h1>
          <p className="mt-1 text-zinc-600">
            {job.title} • {customer?.full_name ?? "Unknown customer"}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800">
              Signed
            </span>
            {displayContract.signed_at && (
              <span className="text-zinc-600">
                Signed {formatDateEastern(displayContract.signed_at)}
              </span>
            )}
            {displayContract.signing_method && (
              <span className="text-zinc-600 capitalize">
                {displayContract.signing_method} signing
              </span>
            )}
            {displayContract.price != null && (
              <span className="font-medium text-zinc-900">
                ${Number(displayContract.price).toLocaleString()}
              </span>
            )}
          </div>
          {signedPrice != null && (
            <dl className="mt-4 grid gap-2 border-t border-zinc-100 pt-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-zinc-500">Contract total</dt>
                <dd className="font-medium text-zinc-900">${signedPrice.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Deposit</dt>
                <dd className="font-medium text-zinc-900">
                  {signedDeposit != null ? `$${signedDeposit.toLocaleString()}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Balance due on completion</dt>
                <dd className="font-semibold text-[#2436BB]">
                  {signedBalanceDue != null ? `$${signedBalanceDue.toLocaleString()}` : "—"}
                </dd>
              </div>
            </dl>
          )}
          {displayContract.signer_name && (
            <p className="mt-4 text-sm text-zinc-600">
              Signed by: {displayContract.signer_name}
              {displayContract.signer_email && ` (${displayContract.signer_email})`}
            </p>
          )}
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1c2a96]"
            >
              View / Download signed PDF
            </a>
          ) : (
            <p className="mt-4 text-sm text-amber-900">
              Signed PDF isn&apos;t available yet. This can happen if server storage isn&apos;t
              configured (for example <code className="rounded bg-zinc-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              for uploads). Contract details are still stored and locked in JobProof.
            </p>
          )}
        </div>
      </div>
    );
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
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Contract builder</h1>
        <p className="mt-1 text-zinc-600">
          {job.title} • {customer?.full_name ?? "Unknown customer"}
        </p>
      </div>

      <ContractBuilderForm
        jobId={jobId}
        job={job}
        existingContract={contract}
        profile={profile}
        userEmail={user?.email ?? ""}
      />
    </div>
  );
}
