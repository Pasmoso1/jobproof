import Link from "next/link";
import { defaultTaxRateForNewFinancials } from "@/lib/tax/canada";
import { getCustomers, getProfile } from "@/app/(app)/actions";
import { EstimateForm } from "@/app/(app)/estimates/estimate-form";

export default async function CreateEstimatePage() {
  const [customers, profile] = await Promise.all([getCustomers(), getProfile()]);
  const initialTaxRate = String(
    defaultTaxRateForNewFinancials(profile?.province ?? null, null).taxRate
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/estimates" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Estimates
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">New estimate</h1>
        <p className="mt-1 text-zinc-600">
          Build a quote for your customer. Save as a draft, then send when you are ready.
        </p>
      </div>
      <EstimateForm
        customers={customers}
        profileProvince={profile?.province ?? null}
        initialTaxRate={initialTaxRate}
        mode="create"
      />
    </div>
  );
}
