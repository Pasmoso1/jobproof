import Link from "next/link";
import { defaultTaxRateForNewFinancials } from "@/lib/tax/canada";
import { getCustomers, getProfile } from "@/app/(app)/actions";
import { EstimateForm } from "@/app/(app)/estimates/estimate-form";

export const dynamic = "force-dynamic";

export default async function CreateEstimatePage() {
  const [customers, profile] = await Promise.all([getCustomers(), getProfile()]);
  const initialTax = defaultTaxRateForNewFinancials(profile?.province ?? null, null);
  const initialTaxRate = initialTax != null ? String(initialTax.taxRate) : "";

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
        {!initialTax ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Select a property province so JobProof can suggest the correct sales tax. You can still
            edit the tax rate after selecting.
          </p>
        ) : null}
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
