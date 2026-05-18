import Link from "next/link";

export function DisputePreviewCard({
  jobId,
  showProofLink = true,
}: {
  jobId: string;
  showProofLink?: boolean;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-zinc-900">If this job is ever disputed</h2>
      <p className="mt-2 text-sm text-zinc-600">
        JobProof helps keep the important proof in one place — agreements, approvals, photos,
        invoices, timestamps, and payment records.
      </p>
      <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-700">
        <li>Signed agreements</li>
        <li>Timestamped updates</li>
        <li>Approved changes</li>
        <li>Sent invoices</li>
        <li>Payment history</li>
      </ul>
      {showProofLink ? (
        <Link
          href={`/jobs/${jobId}/proof`}
          className="mt-4 inline-flex min-h-[44px] items-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
        >
          View proof report
        </Link>
      ) : null}
    </section>
  );
}
