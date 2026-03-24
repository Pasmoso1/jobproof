import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob } from "../../../actions";
import { EditJobForm } from "./edit-job-form";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getJob(jobId);

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
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Edit job</h1>
        <p className="mt-1 text-zinc-600">
          Update the linked customer’s email, job details, and property address.
        </p>
      </div>

      <EditJobForm
        job={job}
        customerName={customer?.full_name?.trim() || ""}
        customerEmailInitial={customer?.email ?? ""}
      />
    </div>
  );
}
