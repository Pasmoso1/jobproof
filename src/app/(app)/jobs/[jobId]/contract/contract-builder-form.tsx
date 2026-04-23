"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createOrUpdateContract,
  sendRemoteContractSigningLink,
} from "@/app/(app)/actions";
import {
  DEFAULT_CONTRACT_PAYMENT_TERMS_BOILERPLATE,
  DEFAULT_CONTRACT_TERMS_BOILERPLATE,
} from "@/lib/contract-defaults";
import {
  isValidCustomerEmail,
  validateContractBuilderScheduleDates,
  validateCustomerEmailForRemote,
  validateCustomerPhone,
} from "@/lib/validation/job-create";
import { defaultTaxRateForNewFinancials } from "@/lib/tax/canada";
import { computeContractPricingBreakdown, formatContractMoney } from "@/lib/contract-tax-pricing";
import { CONTRACT_PRICING_TOTALS_CLARITY_LINE } from "@/lib/contract-pricing-display-copy";
import { ContractPreview } from "./contract-preview";
import type { Contract, Profile } from "@/types/database";

type Job = {
  id: string;
  title: string;
  description: string | null;
  property_address_line_1?: string | null;
  property_address_line_2?: string | null;
  property_city?: string | null;
  property_province?: string | null;
  property_postal_code?: string | null;
  original_contract_price?: number | null;
  current_contract_total?: number | null;
  deposit_amount?: number | null;
  tax_rate?: number;
  start_date?: string | null;
  estimated_completion_date?: string | null;
  customers?: { full_name?: string; email?: string | null; phone?: string | null } | null;
};

type ContractFormState = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  jobTitle: string;
  jobAddress: string;
  scope: string;
  terms: string;
  paymentTerms: string;
  contractPrice: string;
  depositAmount: string;
  startDate: string;
  completionDate: string;
  taxRate: string;
  companyName: string;
  contractorName: string;
  contractorEmail: string;
  contractorPhone: string;
  contractorAddress: string;
  warrantyNote: string;
  cancellationNote: string;
};

function formatJobAddressLines(j: Job): string {
  return [
    j.property_address_line_1,
    j.property_address_line_2,
    j.property_city,
    j.property_province,
    j.property_postal_code,
  ]
    .filter(Boolean)
    .join(", ");
}

function formatProfileAddressLines(p: Profile | null | undefined): string {
  if (!p) return "";
  return [p.address_line_1, p.address_line_2, p.city, p.province, p.postal_code]
    .filter(Boolean)
    .join(", ");
}

function normalizeDateInput(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {
    /* ignore */
  }
  return s;
}

function buildContractFormState(
  job: Job,
  profile: Profile | null | undefined,
  userEmail: string,
  existingContract: Contract | null
): ContractFormState {
  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  const jobAddr = formatJobAddressLines(job);

  if (existingContract) {
    const cd = (existingContract.contract_data ?? {}) as Record<string, unknown>;
    const savedAddr = existingContract.job_address?.trim();
    return {
      customerName: existingContract.customer_name ?? "",
      customerEmail: existingContract.customer_email ?? "",
      customerPhone: existingContract.customer_phone ?? "",
      jobTitle: existingContract.job_title ?? job.title,
      jobAddress: savedAddr || jobAddr,
      scope: existingContract.scope_of_work ?? String(cd.scope ?? ""),
      terms: String(cd.terms ?? ""),
      paymentTerms: existingContract.payment_terms ?? String(cd.paymentTerms ?? ""),
      contractPrice:
        existingContract.price != null && Number(existingContract.price) > 0
          ? String(existingContract.price)
          : "",
      depositAmount:
        existingContract.deposit_amount != null && Number(existingContract.deposit_amount) > 0
          ? String(existingContract.deposit_amount)
          : "",
      startDate: normalizeDateInput(
        (cd.startDate as string) ?? job.start_date ?? undefined
      ),
      completionDate: normalizeDateInput(
        (cd.completionDate as string) ?? job.estimated_completion_date ?? undefined
      ),
      taxRate:
        existingContract.tax_rate != null &&
        Number.isFinite(Number(existingContract.tax_rate))
          ? String(existingContract.tax_rate)
          : String(
              defaultTaxRateForNewFinancials(profile?.province, job.property_province).taxRate
            ),
      companyName: existingContract.company_name ?? profile?.business_name ?? "",
      contractorName: existingContract.contractor_name ?? profile?.contractor_name ?? "",
      contractorEmail: existingContract.contractor_email ?? userEmail ?? "",
      contractorPhone: existingContract.contractor_phone ?? profile?.phone ?? "",
      contractorAddress:
        existingContract.contractor_address ?? formatProfileAddressLines(profile),
      warrantyNote: existingContract.warranty_note ?? "",
      cancellationNote: existingContract.cancellation_change_note ?? "",
    };
  }

  const priceNum = job.current_contract_total ?? job.original_contract_price;

  const defaultTerms =
    profile?.default_contract_terms_and_conditions?.trim() ||
    DEFAULT_CONTRACT_TERMS_BOILERPLATE;
  const defaultPayment =
    profile?.default_contract_payment_terms?.trim() ||
    DEFAULT_CONTRACT_PAYMENT_TERMS_BOILERPLATE;

  return {
    customerName: customer?.full_name ?? "",
    customerEmail: customer?.email ?? "",
    customerPhone: customer?.phone ?? "",
    jobTitle: job.title,
    jobAddress: jobAddr,
    scope: job.description ?? "",
    terms: defaultTerms,
    paymentTerms: defaultPayment,
    contractPrice: priceNum != null && Number(priceNum) > 0 ? String(priceNum) : "",
    depositAmount:
      job.deposit_amount != null && Number(job.deposit_amount) > 0
        ? String(job.deposit_amount)
        : "",
    startDate: normalizeDateInput(job.start_date),
    completionDate: normalizeDateInput(job.estimated_completion_date),
    taxRate: String(
      defaultTaxRateForNewFinancials(profile?.province, job.property_province).taxRate
    ),
    companyName: profile?.business_name ?? "",
    contractorName: profile?.contractor_name ?? "",
    contractorEmail: userEmail ?? "",
    contractorPhone: profile?.phone ?? "",
    contractorAddress: formatProfileAddressLines(profile),
    warrantyNote: profile?.default_contract_warranty_note ?? "",
    cancellationNote: profile?.default_contract_cancellation_note ?? "",
  };
}

function fieldClass(invalid: boolean) {
  return `mt-1 block w-full rounded-lg border px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#2436BB] ${
    invalid ? "border-red-500 focus:border-red-500" : "border-zinc-300 focus:border-[#2436BB]"
  }`;
}

export function ContractBuilderForm({
  jobId,
  job,
  existingContract,
  profile,
  userEmail,
}: {
  jobId: string;
  job: Job;
  existingContract: Contract | null;
  profile?: Profile | null;
  userEmail?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<ContractFormState>(() =>
    buildContractFormState(job, profile ?? null, userEmail ?? "", existingContract)
  );
  const [contractId, setContractId] = useState<string | null>(
    existingContract?.id ?? null
  );

  const contractWorkflowStatus: "draft" | "pending" | null =
    existingContract?.status === "pending" || existingContract?.status === "draft"
      ? existingContract.status
      : contractId
        ? "draft"
        : null;

  const isAwaitingSignature = contractWorkflowStatus === "pending";

  /** Hide after first successful save so we don’t imply a fresh pre-fill on an unsaved draft. */
  const showPrefillNote = existingContract == null && contractId == null;

  const priceNum = parseFloat(form.contractPrice);
  const hasValidPrice = !Number.isNaN(priceNum) && priceNum > 0;
  const depositNum = parseFloat(form.depositAmount);
  const depositForBalance =
    !Number.isNaN(depositNum) && depositNum >= 0 ? depositNum : 0;
  const formTaxNum = parseFloat(form.taxRate);
  const taxRateOverride =
    Number.isFinite(formTaxNum) && formTaxNum >= 0 ? formTaxNum : null;
  const pricingSummary = computeContractPricingBreakdown(
    hasValidPrice ? priceNum : null,
    depositForBalance > 0 ? depositForBalance : null,
    job.property_province,
    taxRateOverride
  );
  const propertyAddressDisplay = form.jobAddress.trim() || "—";
  const remoteSigningEmailReady = isValidCustomerEmail(form.customerEmail);
  const remoteSigningPhoneReady = validateCustomerPhone(form.customerPhone) === null;

  function patchForm<K extends keyof ContractFormState>(key: K, value: ContractFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateForSigning(): boolean {
    const errs: Record<string, string> = {};
    if (!form.scope?.trim()) errs.scope = "Scope of work is required";
    if (!hasValidPrice) errs.price = "Contract subtotal (before tax) is required";
    if (!form.customerName?.trim()) errs.customerName = "Customer name is required";
    if (!form.paymentTerms?.trim()) errs.paymentTerms = "Payment terms are required";
    const phErr = validateCustomerPhone(form.customerPhone);
    if (phErr) errs.customerPhone = phErr;
    const dateErrs = validateContractBuilderScheduleDates(
      form.startDate,
      form.completionDate
    );
    if (dateErrs) Object.assign(errs, dateErrs);
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function buildPayload() {
    const contractData = {
      scope: form.scope,
      terms: form.terms,
      paymentTerms: form.paymentTerms,
      startDate: form.startDate.trim() || null,
      completionDate: form.completionDate.trim() || null,
      price: hasValidPrice ? priceNum : null,
      deposit: !Number.isNaN(depositNum) && depositNum >= 0 ? depositNum : null,
    };

    const structured = {
      contractorName: form.contractorName.trim() || undefined,
      companyName: form.companyName.trim() || undefined,
      contractorEmail: form.contractorEmail.trim() || userEmail || undefined,
      contractorPhone: form.contractorPhone.trim() || profile?.phone || undefined,
      contractorAddress: form.contractorAddress.trim() || undefined,
      customerName: form.customerName.trim() || undefined,
      customerEmail: form.customerEmail.trim() || undefined,
      customerPhone: form.customerPhone.trim() || undefined,
      jobTitle: form.jobTitle.trim() || job.title,
      jobAddress: form.jobAddress.trim() || undefined,
      scopeOfWork: form.scope.trim() || undefined,
      price: hasValidPrice ? priceNum : undefined,
      depositAmount:
        !Number.isNaN(depositNum) && depositNum >= 0 ? depositNum : undefined,
      paymentTerms: form.paymentTerms.trim() || undefined,
      taxRate: (() => {
        const tr = parseFloat(form.taxRate);
        return Number.isFinite(tr) && tr >= 0 ? tr : undefined;
      })(),
      warrantyNote: form.warrantyNote.trim() || undefined,
      cancellationChangeNote: form.cancellationNote.trim() || undefined,
    };

    return { contractData, structured };
  }

  async function handleSaveDraft() {
    setError(null);
    setValidationErrors({});
    setLoading(true);

    const { contractData, structured } = buildPayload();

    const result = await createOrUpdateContract(
      jobId,
      contractData,
      "save_draft",
      structured
    );

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    if (result?.contractId) {
      setContractId(result.contractId);
      router.refresh();
    }
  }

  async function handleSavePendingEdits() {
    setError(null);
    setValidationErrors({});
    setLoading(true);

    const { contractData, structured } = buildPayload();

    const result = await createOrUpdateContract(
      jobId,
      contractData,
      "save_pending_edits",
      structured
    );

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    if (result?.contractId) {
      setContractId(result.contractId);
      router.refresh();
    }
  }

  async function handleWithdrawToDraft() {
    if (
      !window.confirm(
        "Move this contract back to draft? It will no longer await customer signature, and any existing remote signing links will stop working. Use this if you need to fix the contract before sending a new link."
      )
    ) {
      return;
    }

    setError(null);
    setValidationErrors({});
    setLoading(true);

    const { contractData, structured } = buildPayload();

    const result = await createOrUpdateContract(
      jobId,
      contractData,
      "withdraw_to_draft",
      structured
    );

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    if (result?.contractId) {
      setContractId(result.contractId);
      router.refresh();
    }
  }

  async function handleProceedToDeviceSigning() {
    setError(null);
    setValidationErrors({});
    if (!validateForSigning()) {
      return;
    }
    setLoading(true);

    const { contractData, structured } = buildPayload();

    const result = await createOrUpdateContract(
      jobId,
      contractData,
      "submit_for_signing",
      structured
    );

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    if (result?.contractId) {
      setContractId(result.contractId);
      router.push(`/jobs/${jobId}/contract/sign?contractId=${result.contractId}`);
      router.refresh();
    }
  }

  async function handleSendForRemoteSigning() {
    setError(null);
    setValidationErrors((p) => ({ ...p, customer_email: "" }));

    const remoteEmailErr = validateCustomerEmailForRemote(form.customerEmail);
    if (remoteEmailErr) {
      setValidationErrors((p) => ({ ...p, customer_email: remoteEmailErr }));
      return;
    }

    const remotePhoneErr = validateCustomerPhone(form.customerPhone);
    if (remotePhoneErr) {
      setValidationErrors((p) => ({ ...p, customerPhone: remotePhoneErr }));
      return;
    }

    if (!validateForSigning()) {
      return;
    }

    setLoading(true);
    try {
      const { contractData, structured } = buildPayload();

      const saveResult = await createOrUpdateContract(
        jobId,
        contractData,
        "save_for_remote_delivery",
        structured
      );
      if (saveResult?.error) {
        setError(saveResult.error);
        return;
      }
      const cId = saveResult?.contractId ?? contractId;
      if (!cId) {
        setError("Failed to save contract");
        return;
      }

      const publicOrigin =
        typeof window !== "undefined" ? window.location.origin : undefined;
      const remoteResult = await sendRemoteContractSigningLink({
        jobId,
        contractId: cId,
        toEmail: form.customerEmail.trim(),
        customerName: form.customerName.trim(),
        jobTitle: form.jobTitle.trim() || job.title,
        publicOrigin,
      });

      if (remoteResult?.error) {
        setError(remoteResult.error);
        return;
      }

      setContractId(cId);
      const emailEnc = encodeURIComponent(form.customerEmail.trim());
      router.push(`/jobs/${jobId}?contractSent=1&contractEmail=${emailEnc}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]";

  return (
    <div className="space-y-6">
      {showPrefillNote && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
          Contract details have been pre-filled from this job and your business profile.
        </div>
      )}

      {contractWorkflowStatus === "pending" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Awaiting customer signature</strong>
          <span className="text-amber-900">
            {" "}
            — Use <em>Save changes (awaiting signature)</em> to edit without changing status. To return to
            internal drafting, use <em>Move back to draft</em>.
          </span>
        </div>
      )}

      {contractWorkflowStatus === "draft" && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
          <strong>Draft</strong>
          <span className="text-zinc-600">
            {" "}
            — Not yet sent for signing. Save anytime, then continue to on-device or remote signing when
            ready.
          </span>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-zinc-900">Contract details</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Customer</dt>
            <dd className="font-medium text-zinc-900">
              {form.customerName.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Property address</dt>
            <dd className="font-medium text-zinc-900">{propertyAddressDisplay}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Contract subtotal (before tax)</dt>
            <dd className="font-medium text-zinc-900">
              {pricingSummary
                ? formatContractMoney(pricingSummary.subtotalPreTax)
                : hasValidPrice
                  ? `$${priceNum.toLocaleString()}`
                  : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">
              {pricingSummary ? `Tax (${pricingSummary.taxShortLabel})` : "Tax"}
            </dt>
            <dd className="font-medium text-zinc-900">
              {pricingSummary ? formatContractMoney(pricingSummary.taxAmount) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Total (including tax)</dt>
            <dd className="font-medium text-zinc-900">
              {pricingSummary
                ? formatContractMoney(pricingSummary.totalIncludingTax)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Deposit</dt>
            <dd className="font-medium text-zinc-900">
              {pricingSummary
                ? formatContractMoney(pricingSummary.depositApplied)
                : depositForBalance > 0
                  ? `$${depositForBalance.toLocaleString()}`
                  : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Balance due on completion</dt>
            <dd className="font-semibold text-[#2436BB]">
              {pricingSummary
                ? formatContractMoney(pricingSummary.balanceDueOnCompletion)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Sales tax rate</dt>
            <dd className="font-medium text-zinc-900">
              {pricingSummary?.taxShortLabel ?? "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">Payment terms</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-zinc-700">
              {form.paymentTerms?.trim() || "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50/90 px-3 py-2 text-xs leading-relaxed text-blue-950 sm:text-sm">
          {CONTRACT_PRICING_TOTALS_CLARITY_LINE}
        </p>
      </div>

      <form
        className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          handleProceedToDeviceSigning();
        }}
      >
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{error}</p>
            {error.includes("business details") && (
              <Link
                href="/settings/business"
                className="mt-2 inline-block font-medium text-red-800 underline hover:no-underline"
              >
                Add business details →
              </Link>
            )}
          </div>
        )}

        <div className="space-y-4 border-b border-zinc-100 pb-6">
          <h3 className="text-sm font-semibold text-zinc-900">Customer</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="customerName" className="block text-sm font-medium text-zinc-700">
                Customer name <span className="text-red-500">*</span>
              </label>
              <input
                id="customerName"
                type="text"
                value={form.customerName}
                onChange={(e) => {
                  patchForm("customerName", e.target.value);
                  if (validationErrors.customerName)
                    setValidationErrors((p) => ({ ...p, customerName: "" }));
                }}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="customerEmail" className="block text-sm font-medium text-zinc-700">
                Customer email
              </label>
              <input
                id="customerEmail"
                type="email"
                value={form.customerEmail}
                onChange={(e) => {
                  patchForm("customerEmail", e.target.value);
                  if (validationErrors.customer_email)
                    setValidationErrors((p) => ({ ...p, customer_email: "" }));
                }}
                className={
                  validationErrors.customer_email
                    ? fieldClass(true)
                    : inputCls
                }
                aria-invalid={!!validationErrors.customer_email}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Required for remote signing and invoices. You can edit it here for this contract only.
              </p>
              {validationErrors.customer_email && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.customer_email}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="customerPhone" className="block text-sm font-medium text-zinc-700">
                Customer phone <span className="text-red-500">*</span>
              </label>
              <input
                id="customerPhone"
                type="tel"
                required
                value={form.customerPhone}
                onChange={(e) => {
                  patchForm("customerPhone", e.target.value);
                  if (validationErrors.customerPhone)
                    setValidationErrors((p) => ({ ...p, customerPhone: "" }));
                }}
                className={validationErrors.customerPhone ? fieldClass(true) : inputCls}
                aria-invalid={!!validationErrors.customerPhone}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Required before sending or signing the contract.
              </p>
              {validationErrors.customerPhone && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {validationErrors.customerPhone}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 border-b border-zinc-100 pb-6">
          <h3 className="text-sm font-semibold text-zinc-900">Job</h3>
          <div>
            <label htmlFor="jobTitle" className="block text-sm font-medium text-zinc-700">
              Job title
            </label>
            <input
              id="jobTitle"
              type="text"
              value={form.jobTitle}
              onChange={(e) => patchForm("jobTitle", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="jobAddress" className="block text-sm font-medium text-zinc-700">
              Job / property address
            </label>
            <textarea
              id="jobAddress"
              rows={2}
              value={form.jobAddress}
              onChange={(e) => patchForm("jobAddress", e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-zinc-700">
                Estimated start date <span className="text-red-500">*</span>
              </label>
              <input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) => {
                  patchForm("startDate", e.target.value);
                  if (validationErrors.startDate)
                    setValidationErrors((p) => ({ ...p, startDate: "" }));
                }}
                className={fieldClass(!!validationErrors.startDate)}
                aria-invalid={!!validationErrors.startDate}
              />
              {validationErrors.startDate && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.startDate}</p>
              )}
            </div>
            <div>
              <label htmlFor="completionDate" className="block text-sm font-medium text-zinc-700">
                Estimated completion date <span className="text-red-500">*</span>
              </label>
              <input
                id="completionDate"
                type="date"
                value={form.completionDate}
                onChange={(e) => {
                  patchForm("completionDate", e.target.value);
                  if (validationErrors.completionDate)
                    setValidationErrors((p) => ({ ...p, completionDate: "" }));
                }}
                className={fieldClass(!!validationErrors.completionDate)}
                aria-invalid={!!validationErrors.completionDate}
              />
              {validationErrors.completionDate && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.completionDate}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 border-b border-zinc-100 pb-6">
          <h3 className="text-sm font-semibold text-zinc-900">Financial</h3>
          <p className="text-xs text-zinc-600">
            Contract amount is the subtotal before tax. The default rate uses your business province
            (Settings → Business) when set; otherwise it follows the job site province. You can edit
            the decimal rate below.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contractPrice" className="block text-sm font-medium text-zinc-700">
                Contract subtotal — before tax ($) <span className="text-red-500">*</span>
              </label>
              <input
                id="contractPrice"
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={form.contractPrice}
                onChange={(e) => {
                  patchForm("contractPrice", e.target.value);
                  if (validationErrors.price) setValidationErrors((p) => ({ ...p, price: "" }));
                }}
                className={`no-spinner ${inputCls}`}
              />
            </div>
            <div>
              <label htmlFor="depositField" className="block text-sm font-medium text-zinc-700">
                Deposit ($)
              </label>
              <input
                id="depositField"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={form.depositAmount}
                onChange={(e) => patchForm("depositAmount", e.target.value)}
                className={`no-spinner ${inputCls}`}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 border-b border-zinc-100 pb-6">
          <h3 className="text-sm font-semibold text-zinc-900">Contractor</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-zinc-700">
                Business / company name
              </label>
              <input
                id="companyName"
                type="text"
                value={form.companyName}
                onChange={(e) => patchForm("companyName", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="contractorNameField" className="block text-sm font-medium text-zinc-700">
                Contractor name
              </label>
              <input
                id="contractorNameField"
                type="text"
                value={form.contractorName}
                onChange={(e) => patchForm("contractorName", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="contractorEmail" className="block text-sm font-medium text-zinc-700">
                Contractor email
              </label>
              <input
                id="contractorEmail"
                type="email"
                value={form.contractorEmail}
                onChange={(e) => patchForm("contractorEmail", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="contractorPhone" className="block text-sm font-medium text-zinc-700">
                Contractor phone
              </label>
              <input
                id="contractorPhone"
                type="tel"
                value={form.contractorPhone}
                onChange={(e) => patchForm("contractorPhone", e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="contractorAddress" className="block text-sm font-medium text-zinc-700">
                Contractor address
              </label>
              <textarea
                id="contractorAddress"
                rows={2}
                value={form.contractorAddress}
                onChange={(e) => patchForm("contractorAddress", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="scope" className="block text-sm font-medium text-zinc-700">
            Scope of work <span className="text-red-500">*</span>
          </label>
          <textarea
            id="scope"
            rows={6}
            value={form.scope}
            onChange={(e) => {
              patchForm("scope", e.target.value);
              if (validationErrors.scope) setValidationErrors((p) => ({ ...p, scope: "" }));
            }}
            placeholder="Describe the work to be performed..."
            className={fieldClass(!!validationErrors.scope)}
          />
          {validationErrors.scope && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.scope}</p>
          )}
        </div>

        <div>
          <label htmlFor="terms" className="block text-sm font-medium text-zinc-700">
            Terms and conditions
          </label>
          <textarea
            id="terms"
            rows={6}
            value={form.terms}
            onChange={(e) => patchForm("terms", e.target.value)}
            placeholder="Payment terms, warranties, liability..."
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="paymentTerms" className="block text-sm font-medium text-zinc-700">
            Payment terms <span className="text-red-500">*</span>
          </label>
          <textarea
            id="paymentTerms"
            rows={3}
            value={form.paymentTerms}
            onChange={(e) => {
              patchForm("paymentTerms", e.target.value);
              if (validationErrors.paymentTerms)
                setValidationErrors((p) => ({ ...p, paymentTerms: "" }));
            }}
            placeholder="Deposit due on signing, balance on completion..."
            className={fieldClass(!!validationErrors.paymentTerms)}
          />
          {validationErrors.paymentTerms && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.paymentTerms}</p>
          )}
        </div>

        <div>
          <label htmlFor="warrantyNote" className="block text-sm font-medium text-zinc-700">
            Warranty note
          </label>
          <textarea
            id="warrantyNote"
            rows={3}
            value={form.warrantyNote}
            onChange={(e) => patchForm("warrantyNote", e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="cancellationNote" className="block text-sm font-medium text-zinc-700">
            Cancellation / changes note
          </label>
          <textarea
            id="cancellationNote"
            rows={3}
            value={form.cancellationNote}
            onChange={(e) => patchForm("cancellationNote", e.target.value)}
            className={inputCls}
          />
        </div>

        {(validationErrors.customerName ||
          validationErrors.price ||
          validationErrors.customer_email ||
          validationErrors.customerPhone) && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {validationErrors.customerName && <p>{validationErrors.customerName}</p>}
            {validationErrors.price && <p>{validationErrors.price}</p>}
            {validationErrors.customer_email && <p>{validationErrors.customer_email}</p>}
            {validationErrors.customerPhone && <p>{validationErrors.customerPhone}</p>}
          </div>
        )}

        <div className="border-t border-zinc-200 pt-6">
          <h3 className="text-sm font-semibold text-zinc-900">Preview</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            This is how the contract will appear to the customer.
          </p>
          <div className="mt-4">
            <ContractPreview
              jobTitle={form.jobTitle.trim() || job.title}
              customerName={form.customerName.trim() || null}
              customerEmail={form.customerEmail.trim() || null}
              customerPhone={form.customerPhone.trim() || null}
              propertyAddress={propertyAddressDisplay}
              scopeOfWork={form.scope}
              contractPrice={hasValidPrice ? priceNum : null}
              depositAmount={
                !Number.isNaN(depositNum) && depositNum > 0 ? depositNum : null
              }
              paymentTerms={form.paymentTerms}
              termsAndConditions={form.terms}
              startDate={form.startDate.trim() || null}
              completionDate={form.completionDate.trim() || null}
              businessName={form.companyName.trim() || null}
              contractorEmail={form.contractorEmail.trim() || null}
              contractorPhone={form.contractorPhone.trim() || null}
              contractorAddress={form.contractorAddress.trim() || null}
              propertyProvince={job.property_province ?? null}
              taxRateOverride={taxRateOverride}
              warrantyNote={form.warrantyNote.trim() || null}
              cancellationNote={form.cancellationNote.trim() || null}
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-zinc-200 pt-6">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Ready to send or sign</h3>
            <p className="mt-0.5 text-sm text-zinc-600">
              {isAwaitingSignature
                ? "This version is awaiting customer signature. Saving uses “Save changes” so status stays the same. Use “Move back to draft” only if you need to pull it from signing."
                : "Save a draft to continue later, or move to customer signing on this device or by email link."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {isAwaitingSignature ? (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSavePendingEdits}
                  className="rounded-lg border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Saving..." : "Save changes (awaiting signature)"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleWithdrawToDraft}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-6 py-3 font-medium text-amber-950 transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Move back to draft
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleSaveDraft}
                className="rounded-lg border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Saving..." : "Save draft"}
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#2436BB] px-6 py-3 font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading
                ? "Saving..."
                : isAwaitingSignature
                  ? "Open on-device signing"
                  : "Continue to on-device signing"}
            </button>
            <button
              type="button"
              disabled={loading || !remoteSigningEmailReady || !remoteSigningPhoneReady}
              title={
                !remoteSigningEmailReady
                  ? "Add a valid customer email to send a remote signing link."
                  : !remoteSigningPhoneReady
                    ? "Add a valid customer phone number to send a remote signing link."
                    : undefined
              }
              onClick={handleSendForRemoteSigning}
              className="rounded-lg border-2 border-[#2436BB] bg-white px-6 py-3 font-medium text-[#2436BB] transition-colors hover:bg-[#2436BB]/5 focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isAwaitingSignature ? "Send or resend signing link" : "Send for remote signing"}
            </button>
            <Link
              href={`/jobs/${jobId}`}
              className="rounded-lg border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
