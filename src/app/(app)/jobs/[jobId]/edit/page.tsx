import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob } from "../../../actions";
import { EditJobForm } from "./edit-job-form";
import {
  isJobLockedForContractEdits,
  JOB_LOCKED_SIGNED_CONTRACT_MESSAGE,
} from "@/lib/job-contract-lock";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getJob(jobId);

  if (!job) notFound();

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;

  if (isJobLockedForContractEdits(job.contract_status)) {
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
        </div>
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-sm"
          role="status"
        >
          <p className="font-semibold text-amber-900">This job cannot be edited</p>
          <p className="mt-2 text-amber-900/95">{JOB_LOCKED_SIGNED_CONTRACT_MESSAGE}</p>
          <p className="mt-3 text-amber-900/90">
            Customer, property, title, scope, price, schedule, and related fields stay as they were
            when the contract was signed. You can still add job updates, change orders, and invoices
            from the job page.
          </p>
          <Link
            href={`/jobs/${jobId}`}
            className="mt-4 inline-block font-medium text-[#2436BB] hover:underline"
          >
            Return to job →
          </Link>
        </div>
      </div>
    );
  }

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
