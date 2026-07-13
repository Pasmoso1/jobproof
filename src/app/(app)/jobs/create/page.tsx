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
  const initialTax = defaultTaxRateForNewFinancials(profile?.province ?? null, null);
  const initialTaxRate = initialTax != null ? String(initialTax.taxRate) : "";

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
        {!initialTax ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Select a province on the job address (or finish your business profile) so JobProof can
            suggest the correct sales tax. You can still edit the tax rate after selecting.
          </p>
        ) : null}
      </div>

      <CreateJobForm
        customers={customers}
        initialTaxRate={initialTaxRate}
        isFirstProtectedJob={isFirstProtectedJob}
      />
    </div>
  );
}
