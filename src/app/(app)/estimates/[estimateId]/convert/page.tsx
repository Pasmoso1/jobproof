import Link from "next/link";
import { notFound } from "next/navigation";
import { getEstimateById } from "@/app/(app)/estimates/estimate-actions";
import { ConvertToJobForm } from "@/app/(app)/estimates/[estimateId]/convert-to-job-form";

export default async function ConvertEstimatePage({
  params,
}: {
  params: Promise<{ estimateId: string }>;
}) {
  const { estimateId } = await params;
  const estimate = await getEstimateById(estimateId);
  if (!estimate) notFound();
  if (estimate.status !== "accepted") {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">Cannot convert</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Only accepted estimates can be turned into a job. This estimate is not in an accepted
          state.
        </p>
        <Link href={`/estimates/${estimateId}`} className="mt-4 inline-block text-sm font-medium text-[#2436BB]">
          ← Back to estimate
        </Link>
      </div>
    );
  }
  if (estimate.job_id) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">Already converted</h1>
        <p className="mt-2 text-sm text-zinc-600">This estimate is already linked to a job.</p>
        <Link
          href={`/jobs/${estimate.job_id}`}
          className="mt-4 inline-block text-sm font-medium text-[#2436BB]"
        >
          Open job →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href={`/estimates/${estimateId}`}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Back to estimate
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Create job from estimate</h1>
        <p className="mt-1 text-sm text-zinc-600">
          We&apos;ll copy the customer, property address, scope, pricing, deposit, and tax rate from
          your accepted estimate. Enter the trade and schedule to finish creating the job.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <ConvertToJobForm estimateId={estimateId} />
      </div>
    </div>
  );
}
