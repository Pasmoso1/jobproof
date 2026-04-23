import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getJob, getContractForJob, getProfile } from "@/app/(app)/actions";
import { DeviceSigningForm } from "./device-signing-form";

export default async function DeviceSigningPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ contractId?: string }>;
}) {
  const { jobId } = await params;
  const { contractId } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [job, contract, profile] = await Promise.all([
    getJob(jobId),
    getContractForJob(jobId),
    getProfile(),
  ]);

  if (!job) notFound();

  const activeContract = contractId
    ? contract?.id === contractId
      ? contract
      : null
    : contract;

  if (!activeContract || activeContract.status === "signed") {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-zinc-900">Contract</h1>
        <p className="mt-2 text-zinc-600">
          {activeContract?.status === "signed"
            ? "This contract has already been signed."
            : "No pending contract found."}
        </p>
        <Link
          href={`/jobs/${jobId}`}
          className="mt-4 inline-block font-medium text-[#2436BB] hover:underline"
        >
          Back to job
        </Link>
      </div>
    );
  }

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/jobs/${jobId}/contract`}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Back to contract
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Customer signs on device</h1>
        <p className="mt-1 text-zinc-600">
          Have {customer?.full_name ?? "the customer"} sign this contract on your device
        </p>
      </div>

      <DeviceSigningForm
        contractId={activeContract.id}
        jobId={jobId}
        propertyProvince={job.property_province ?? null}
        taxRateOverride={
          activeContract.tax_rate != null && Number.isFinite(Number(activeContract.tax_rate))
            ? Number(activeContract.tax_rate)
            : null
        }
        contractData={{
          ...(activeContract.contract_data as Record<string, unknown>),
          scope_of_work: activeContract.scope_of_work,
          price: activeContract.price,
          deposit_amount: activeContract.deposit_amount,
          payment_terms: activeContract.payment_terms,
          warranty_note: activeContract.warranty_note,
          cancellation_change_note: activeContract.cancellation_change_note,
          tax_rate: activeContract.tax_rate,
        }}
        jobTitle={activeContract.job_title ?? job.title}
        customerName={activeContract.customer_name ?? customer?.full_name ?? null}
        customerEmail={activeContract.customer_email ?? customer?.email ?? null}
        customerPhone={activeContract.customer_phone ?? customer?.phone ?? null}
        propertyAddress={
          activeContract.job_address ??
          ([
            job.property_address_line_1,
            job.property_address_line_2,
            job.property_city,
            job.property_province,
            job.property_postal_code,
          ]
            .filter(Boolean)
            .join(", ") ||
            "—")
        }
        businessName={activeContract.company_name ?? profile?.business_name ?? null}
        contractorEmail={activeContract.contractor_email ?? user?.email ?? null}
        contractorPhone={activeContract.contractor_phone ?? profile?.phone ?? null}
        contractorAddress={
          activeContract.contractor_address ??
          (profile
            ? [profile.address_line_1, profile.address_line_2, profile.city, profile.province, profile.postal_code]
                .filter(Boolean)
                .join(", ") || null
            : null)
        }
      />
    </div>
  );
}
