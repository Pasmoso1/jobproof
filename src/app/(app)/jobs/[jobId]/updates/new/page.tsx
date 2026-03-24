import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob, getJobUpdates } from "../../../../actions";
import { AddUpdateForm } from "./add-update-form";
import { RecentJobUpdatesPanel } from "./recent-job-updates-panel";

export default async function NewUpdatePage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const [job, updates] = await Promise.all([getJob(jobId), getJobUpdates(jobId)]);

  if (!job) notFound();

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/jobs/${jobId}`}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Back to job
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Add update</h1>
        <p className="mt-1 text-zinc-600">
          {job.title} • {customer?.full_name ?? "Unknown customer"}
        </p>
      </div>

      <AddUpdateForm jobId={jobId} />

      <RecentJobUpdatesPanel jobId={jobId} updates={updates} />
    </div>
  );
}
