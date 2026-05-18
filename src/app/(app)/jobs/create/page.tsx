import Link from "next/link";
import { defaultTaxRateForNewFinancials } from "@/lib/tax/canada";
import { getCustomers, getJobs, getProfile } from "../../actions";
import { CreateJobForm } from "./create-job-form";

export const dynamic = "force-dynamic";

export default async function CreateJobPage() {
  const [customers, profile, jobs] = await Promise.all([
    getCustomers(),
    getProfile(),
    getJobs(),
  ]);
  const isFirstProtectedJob = jobs.length === 0;
  const initialTaxRate = String(
    defaultTaxRateForNewFinancials(profile?.province ?? null, null).taxRate
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">
          {isFirstProtectedJob ? "Create your first protected job" : "Create job"}
        </h1>
        <p className="mt-1 text-zinc-600">
          {isFirstProtectedJob
            ? "Start with the basics. You can add photos, contracts, estimates, and invoices after the job is created."
            : "Add a new job with customer details and scope."}
        </p>
      </div>

      <CreateJobForm
        customers={customers}
        initialTaxRate={initialTaxRate}
        isFirstProtectedJob={isFirstProtectedJob}
      />
    </div>
  );
}
