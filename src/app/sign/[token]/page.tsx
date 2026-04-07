import {
  getRemoteSigningBundle,
  type RemoteSigningFailureReason,
} from "@/app/(app)/actions";
import { ContractPreview } from "@/app/(app)/jobs/[jobId]/contract/contract-preview";
import { RemoteSigningForm } from "./remote-signing-form";

function signingLinkCopy(reason: RemoteSigningFailureReason): {
  title: string;
  body: string;
} {
  switch (reason) {
    case "cancelled":
    case "withdrawn":
      return {
        title: "Signing link not available",
        body: "This signing link is no longer valid. Please contact the contractor for an updated contract.",
      };
    case "expired":
      return {
        title: "This signing link has expired",
        body: "Please contact the contractor for a new link.",
      };
    case "already_used":
      return {
        title: "This link was already used",
        body: "This contract may already be signed. If you need help, contact your contractor.",
      };
    case "invalid":
    default:
      return {
        title: "We couldn’t open this signing link",
        body: "Check the URL or contact your contractor for a new link.",
      };
  }
}

export default async function RemoteSigningPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const bundle = await getRemoteSigningBundle(token);

  if (!bundle.ok) {
    const { title, body } = signingLinkCopy(bundle.reason);
    return (
      <div className="min-h-screen bg-zinc-50 py-12">
        <div className="mx-auto max-w-lg px-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
            <p className="mt-3 text-sm text-zinc-600">{body}</p>
          </div>
        </div>
      </div>
    );
  }

  const cd = bundle.data as {
    job_title: string;
    customer_name: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    job_address?: string | null;
    scope_of_work: string | null;
    price: number | null;
    deposit_amount: number | null;
    payment_terms: string | null;
    company_name?: string | null;
    contractor_name?: string | null;
    contractor_email?: string | null;
    contractor_phone?: string | null;
    contractor_address?: string | null;
    tax_rate?: number | null;
    warranty_note?: string | null;
    cancellation_change_note?: string | null;
    contract_data?: { scope?: string; terms?: string; startDate?: string; completionDate?: string };
    property_province?: string | null;
  };

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="mx-auto max-w-3xl px-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-zinc-900">
            Sign contract: {cd.job_title}
          </h1>
          <p className="mt-1 text-zinc-600">
            Customer: {cd.customer_name ?? "—"}
          </p>
          <p className="mt-4 text-sm text-zinc-500">
            Please review the full contract below and sign to accept the terms.
          </p>

          <div className="mt-6">
            <ContractPreview
              jobTitle={cd.job_title}
              customerName={cd.customer_name ?? null}
              customerEmail={cd.customer_email ?? null}
              customerPhone={cd.customer_phone ?? null}
              propertyAddress={cd.job_address ?? "—"}
              scopeOfWork={String(cd.scope_of_work ?? cd.contract_data?.scope ?? "")}
              contractPrice={cd.price ?? null}
              depositAmount={cd.deposit_amount ?? null}
              paymentTerms={String(cd.payment_terms ?? "")}
              termsAndConditions={String(cd.contract_data?.terms ?? "")}
              startDate={(cd.contract_data?.startDate as string) ?? null}
              completionDate={(cd.contract_data?.completionDate as string) ?? null}
              businessName={cd.company_name ?? cd.contractor_name ?? null}
              contractorEmail={cd.contractor_email ?? null}
              contractorPhone={cd.contractor_phone ?? null}
              contractorAddress={cd.contractor_address ?? null}
              propertyProvince={cd.property_province ?? null}
              warrantyNote={cd.warranty_note?.trim() ? cd.warranty_note : null}
              cancellationNote={
                cd.cancellation_change_note?.trim() ? cd.cancellation_change_note : null
              }
            />
          </div>

          <RemoteSigningForm token={token} />
        </div>
      </div>
    </div>
  );
}
