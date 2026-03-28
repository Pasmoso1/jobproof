import { balanceDueOnCompletion } from "@/lib/contract-pricing-display";

type ContractPreviewProps = {
  jobTitle: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  propertyAddress: string;
  scopeOfWork: string;
  contractPrice: number | null;
  depositAmount: number | null;
  paymentTerms: string;
  termsAndConditions: string;
  startDate: string | null;
  completionDate: string | null;
  businessName?: string | null;
  contractorEmail?: string | null;
  contractorPhone?: string | null;
  contractorAddress?: string | null;
  /** Decimal rate e.g. 0.13 for 13% */
  taxRate?: number | null;
  warrantyNote?: string | null;
  cancellationNote?: string | null;
};

export function ContractPreview({
  jobTitle,
  customerName,
  customerEmail,
  customerPhone,
  propertyAddress,
  scopeOfWork,
  contractPrice,
  depositAmount,
  paymentTerms,
  termsAndConditions,
  startDate,
  completionDate,
  businessName,
  contractorEmail,
  contractorPhone,
  contractorAddress,
  taxRate,
  warrantyNote,
  cancellationNote,
}: ContractPreviewProps) {
  const balanceDue = balanceDueOnCompletion(contractPrice, depositAmount);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* Document-style header */}
      <div className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-4">
        <h2 className="text-lg font-semibold text-zinc-900">Contract Agreement</h2>
        <p className="mt-0.5 text-sm text-zinc-600">{jobTitle}</p>
        <p className="mt-1 text-xs text-zinc-500">
          Prepared {new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="space-y-0 divide-y divide-zinc-100">
        {/* Contractor information */}
        <section className="px-6 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Contractor
          </h3>
          <p className="mt-2 text-sm font-medium text-zinc-900">
            {businessName || "—"}
          </p>
          {contractorEmail && (
            <p className="mt-0.5 text-sm text-zinc-600">{contractorEmail}</p>
          )}
          {contractorPhone && (
            <p className="text-sm text-zinc-600">{contractorPhone}</p>
          )}
          {contractorAddress && (
            <p className="text-sm text-zinc-600">{contractorAddress}</p>
          )}
          {!businessName && !contractorEmail && !contractorPhone && !contractorAddress && (
            <p className="mt-0.5 text-sm text-zinc-500">(Add business details in Settings)</p>
          )}
        </section>

        {/* Customer information */}
        <section className="px-6 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Customer
          </h3>
          <p className="mt-2 text-sm font-medium text-zinc-900">
            {customerName || "—"}
          </p>
          {customerEmail && (
            <p className="mt-0.5 text-sm text-zinc-600">{customerEmail}</p>
          )}
          {customerPhone && (
            <p className="text-sm text-zinc-600">{customerPhone}</p>
          )}
        </section>

        {/* Job / Property information */}
        <section className="px-6 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Job & Property
          </h3>
          <p className="mt-2 text-sm font-medium text-zinc-900">{jobTitle}</p>
          <p className="mt-1 text-sm text-zinc-600">
            Property: {propertyAddress || "—"}
          </p>
          {(startDate || completionDate) && (
            <p className="mt-1 text-sm text-zinc-600">
              {startDate && `Start: ${new Date(startDate).toLocaleDateString()}`}
              {startDate && completionDate && " • "}
              {completionDate && `Completion: ${new Date(completionDate).toLocaleDateString()}`}
            </p>
          )}
        </section>

        {/* Scope of work */}
        <section className="px-6 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Scope of Work
          </h3>
          <div className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">
            {scopeOfWork || "—"}
          </div>
        </section>

        {/* Contract price */}
        <section className="px-6 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Contract Price
          </h3>
          <div className="mt-2 space-y-1">
            {contractPrice != null && contractPrice > 0 && (
              <p className="text-sm font-semibold text-zinc-900">
                Total: ${Number(contractPrice).toLocaleString()}
              </p>
            )}
            {depositAmount != null && depositAmount > 0 && (
              <p className="text-sm text-zinc-600">
                Deposit: ${Number(depositAmount).toLocaleString()}
              </p>
            )}
            {balanceDue != null && (
              <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2">
                <p className="text-sm font-semibold text-blue-950">
                  Balance due on completion: ${balanceDue.toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs text-blue-900/80">
                  Contract total minus deposit (amount remaining when work is complete).
                </p>
              </div>
            )}
            {(!contractPrice || contractPrice <= 0) && (
              <p className="text-sm text-zinc-500">—</p>
            )}
            {taxRate != null && taxRate > 0 && (
              <p className="text-sm text-zinc-600">
                Tax rate: {(taxRate * 100).toLocaleString(undefined, { maximumFractionDigits: 4 })}%
              </p>
            )}
          </div>
        </section>

        {/* Payment terms */}
        <section className="px-6 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Payment Terms
          </h3>
          <div className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">
            {paymentTerms || "—"}
          </div>
        </section>

        {/* Terms and conditions */}
        {termsAndConditions && (
          <section className="px-6 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Terms and Conditions
            </h3>
            <div className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">
              {termsAndConditions}
            </div>
          </section>
        )}

        {warrantyNote?.trim() && (
          <section className="px-6 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Warranty
            </h3>
            <div className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">{warrantyNote}</div>
          </section>
        )}

        {cancellationNote?.trim() && (
          <section className="px-6 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Cancellation &amp; changes
            </h3>
            <div className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">{cancellationNote}</div>
          </section>
        )}

        {/* Signature section */}
        <section className="px-6 py-6 bg-zinc-50/50">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Signature
          </h3>
          <p className="mt-3 text-sm text-zinc-600">
            By signing below, you confirm that you have read this contract, understand it, and agree
            to be legally bound by its terms.
          </p>
          <div className="mt-4 flex items-end gap-8">
            <div className="flex-1 border-b-2 border-zinc-300 pb-1">
              <p className="text-xs text-zinc-500">Customer signature</p>
            </div>
            <div className="flex-1 border-b-2 border-zinc-300 pb-1">
              <p className="text-xs text-zinc-500">Date</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
