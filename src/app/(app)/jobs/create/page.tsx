import Link from "next/link";
import { getCustomers } from "../../actions";
import { CreateJobForm } from "./create-job-form";

export default async function CreateJobPage() {
  const customers = await getCustomers();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Create job</h1>
        <p className="mt-1 text-zinc-600">
          Add a new job with customer details and scope.
        </p>
      </div>

      <CreateJobForm customers={customers} />
    </div>
  );
}
