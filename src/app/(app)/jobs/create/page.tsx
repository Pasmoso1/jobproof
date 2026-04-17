import Link from "next/link";
import { defaultTaxRateForNewFinancials } from "@/lib/tax/canada";
import { getCustomers, getProfile } from "../../actions";
import { CreateJobForm } from "./create-job-form";

export default async function CreateJobPage() {
  const [customers, profile] = await Promise.all([getCustomers(), getProfile()]);
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
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Create job</h1>
        <p className="mt-1 text-zinc-600">
          Add a new job with customer details and scope.
        </p>
      </div>

      <CreateJobForm customers={customers} initialTaxRate={initialTaxRate} />
    </div>
  );
}
