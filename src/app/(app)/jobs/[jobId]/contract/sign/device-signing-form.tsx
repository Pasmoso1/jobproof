"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signContractDevice } from "@/app/(app)/actions";
import { validateCustomerPhone } from "@/lib/validation/job-create";
import { ContractPreview } from "../contract-preview";

export function DeviceSigningForm({
  contractId,
  jobId,
  contractData,
  jobTitle,
  customerName,
  customerEmail,
  customerPhone,
  propertyAddress,
  businessName,
  contractorEmail,
  contractorPhone,
  contractorAddress,
  propertyProvince,
}: {
  contractId: string;
  jobId: string;
  contractData: Record<string, unknown>;
  jobTitle: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  propertyAddress: string;
  propertyProvince: string | null;
  businessName?: string | null;
  contractorEmail?: string | null;
  contractorPhone?: string | null;
  contractorAddress?: string | null;
}) {
  const router = useRouter();
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerPhone, setSignerPhone] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const phErr = validateCustomerPhone(signerPhone);
    if (phErr) {
      setError(phErr);
      return;
    }
    setLoading(true);

    const result = await signContractDevice(contractId, {
      signerName: signerName.trim(),
      signerEmail: signerEmail.trim(),
      signerPhone: signerPhone.trim(),
      consentCheckbox: consentChecked,
    });

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    router.push(`/jobs/${jobId}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <strong>Customer signing:</strong> The customer (homeowner/client) should review the contract below, then enter their information and sign to accept.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="font-medium text-zinc-900">Contract</h2>
        <p className="mt-0.5 text-sm text-zinc-600">
          Please review the full agreement before signing.
        </p>
        <div className="mt-4">
          <ContractPreview
            jobTitle={jobTitle}
            customerName={customerName}
            customerEmail={customerEmail}
            customerPhone={customerPhone}
            propertyAddress={propertyAddress}
            scopeOfWork={String(contractData.scope_of_work ?? contractData.scope ?? "")}
            contractPrice={(contractData.price as number) ?? null}
            depositAmount={
              (contractData.deposit_amount ?? contractData.deposit) != null
                ? Number(contractData.deposit_amount ?? contractData.deposit)
                : null
            }
            paymentTerms={String(contractData.payment_terms ?? contractData.paymentTerms ?? "")}
            termsAndConditions={String(contractData.terms ?? "")}
            startDate={(contractData.startDate as string) ?? null}
            completionDate={(contractData.completionDate as string) ?? null}
            businessName={businessName ?? null}
            contractorEmail={contractorEmail ?? null}
            contractorPhone={contractorPhone ?? null}
            contractorAddress={contractorAddress ?? null}
            propertyProvince={propertyProvince}
            warrantyNote={String(contractData.warranty_note ?? "") || null}
            cancellationNote={String(contractData.cancellation_change_note ?? "") || null}
          />
        </div>
      </div>

      <div>
        <label htmlFor="signerName" className="block text-sm font-medium text-zinc-700">
          Customer name <span className="text-red-500">*</span>
        </label>
        <input
          id="signerName"
          type="text"
          required
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Customer's full legal name"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
        />
      </div>

      <div>
        <label htmlFor="signerEmail" className="block text-sm font-medium text-zinc-700">
          Customer email <span className="text-red-500">*</span>
        </label>
        <input
          id="signerEmail"
          type="email"
          required
          value={signerEmail}
          onChange={(e) => setSignerEmail(e.target.value)}
          placeholder="customer@example.com"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
        />
      </div>

      <div>
        <label htmlFor="signerPhone" className="block text-sm font-medium text-zinc-700">
          Customer phone <span className="text-red-500">*</span>
        </label>
        <input
          id="signerPhone"
          type="tel"
          required
          value={signerPhone}
          onChange={(e) => setSignerPhone(e.target.value)}
          placeholder="(555) 123-4567"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
        />
      </div>

      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-900">
        By signing below, you confirm that you have read this contract, understand it, and agree to
        be legally bound by its terms.
      </p>

      <div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            required
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-[#2436BB] focus:ring-[#2436BB]"
          />
          <span className="text-sm text-zinc-700">
            I have read this contract, understand it, and agree to its terms. I confirm that I am
            authorized to sign and enter into this legally binding agreement.
          </span>
        </label>
      </div>

      <div className="flex gap-3 border-t border-zinc-200 pt-6">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#2436BB] px-6 py-3 font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Signing..." : "Customer signs contract"}
        </button>
        <Link
          href={`/jobs/${jobId}/contract`}
          className="rounded-lg border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
