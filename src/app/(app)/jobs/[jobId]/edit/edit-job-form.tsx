"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateJob } from "../../../actions";
import {
  parsePositiveContractPrice,
  validateCustomerEmail,
  validateJobEstimatedScheduleDates,
  validateScopeOfWork,
  validateTrade,
} from "@/lib/validation/job-create";

type Job = {
  id: string;
  title: string;
  description: string | null;
  service_category: string | null;
  property_address_line_1: string | null;
  property_address_line_2: string | null;
  property_city: string | null;
  property_province: string | null;
  property_postal_code: string | null;
  deposit_amount: number | null;
  tax_rate: number;
  start_date: string | null;
  estimated_completion_date: string | null;
  original_contract_price: number | null;
};

export function EditJobForm({
  job,
  customerName,
  customerEmailInitial,
}: {
  job: Job;
  /** Linked customer display name (read-only here). */
  customerName: string;
  /** Initial email; edits persist to the customer record on save. */
  customerEmailInitial: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState(job.title ?? "");
  const [scopeOfWork, setScopeOfWork] = useState(job.description ?? "");
  const [serviceCategory, setServiceCategory] = useState(job.service_category ?? "");
  const [propertyAddressLine1, setPropertyAddressLine1] = useState(job.property_address_line_1 ?? "");
  const [propertyAddressLine2, setPropertyAddressLine2] = useState(job.property_address_line_2 ?? "");
  const [propertyCity, setPropertyCity] = useState(job.property_city ?? "");
  const [propertyProvince, setPropertyProvince] = useState(job.property_province ?? "");
  const [propertyPostalCode, setPropertyPostalCode] = useState(job.property_postal_code ?? "");
  const [depositAmount, setDepositAmount] = useState(
    job.deposit_amount != null ? String(job.deposit_amount) : ""
  );
  const [taxRate, setTaxRate] = useState(
    job.tax_rate != null ? String(job.tax_rate) : ""
  );
  const [startDate, setStartDate] = useState(() => {
    const s = job.start_date ?? "";
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
  });
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState(() => {
    const s = job.estimated_completion_date ?? "";
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
  });
  const [originalContractPrice, setOriginalContractPrice] = useState(
    job.original_contract_price != null ? String(job.original_contract_price) : ""
  );
  const [customerEmail, setCustomerEmail] = useState(customerEmailInitial.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs: Record<string, string> = {};
    const scopeErr = validateScopeOfWork(scopeOfWork);
    if (scopeErr) errs.scope_of_work = scopeErr;
    const priceRes = parsePositiveContractPrice(originalContractPrice);
    if (!priceRes.ok) errs.original_contract_price = priceRes.message;
    const tradeErr = validateTrade(serviceCategory);
    if (tradeErr) errs.service_category = tradeErr;
    const custEmailErr = validateCustomerEmail(customerEmail);
    if (custEmailErr) errs.customer_email = custEmailErr;
    const scheduleErrs = validateJobEstimatedScheduleDates(startDate, estimatedCompletionDate);
    if (scheduleErrs) Object.assign(errs, scheduleErrs);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    const formData = new FormData();
    formData.set("title", title.trim());
    formData.set("scope_of_work", scopeOfWork.trim());
    formData.set("service_category", serviceCategory.trim() || "");
    formData.set("property_address_line_1", propertyAddressLine1.trim() || "");
    formData.set("property_address_line_2", propertyAddressLine2.trim() || "");
    formData.set("property_city", propertyCity.trim() || "");
    formData.set("property_province", propertyProvince.trim() || "");
    formData.set("property_postal_code", propertyPostalCode.trim() || "");
    formData.set("deposit_amount", depositAmount.trim() || "");
    formData.set("tax_rate", taxRate.trim() || "");
    formData.set("start_date", startDate.trim() || "");
    formData.set("estimated_completion_date", estimatedCompletionDate.trim() || "");
    formData.set("original_contract_price", originalContractPrice.trim() || "");
    formData.set("customer_email", customerEmail.trim());

    const result = await updateJob(job.id, formData);

    setLoading(false);

    if (result && "fieldErrors" in result && result.fieldErrors) {
      setFieldErrors(result.fieldErrors as unknown as Record<string, string>);
      return;
    }
    if (result?.error) {
      setError(result.error);
      return;
    }

    router.push(`/jobs/${job.id}`);
    router.refresh();
  }

  return (
    <form
      className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      onSubmit={handleSubmit}
    >
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5">
        <h2 className="text-lg font-semibold text-zinc-900">Customer</h2>
        <p className="mt-1 text-sm text-zinc-600">
          This job is linked to a customer. You can fix their email here; it updates their profile for
          all jobs using this customer.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <span className="block text-sm font-medium text-zinc-700">Customer name</span>
            <p className="mt-1 text-sm text-zinc-900">{customerName.trim() || "—"}</p>
          </div>
          <div>
            <label htmlFor="customerEmail" className="block text-sm font-medium text-zinc-700">
              Customer email <span className="text-red-500">*</span>
            </label>
            <input
              id="customerEmail"
              type="email"
              autoComplete="email"
              value={customerEmail}
              onChange={(e) => {
                setCustomerEmail(e.target.value);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.customer_email;
                  return next;
                });
              }}
              placeholder="name@example.com"
              className={`mt-1 block w-full rounded-lg border px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#2436BB] ${
                fieldErrors.customer_email
                  ? "border-red-500 focus:border-red-500"
                  : "border-zinc-300 focus:border-[#2436BB]"
              }`}
              aria-invalid={!!fieldErrors.customer_email}
              aria-describedby={
                fieldErrors.customer_email
                  ? "customer-email-hint customer-email-error"
                  : "customer-email-hint"
              }
            />
            <p id="customer-email-hint" className="mt-1 text-xs text-zinc-500">
              Required for contracts, remote signing, and invoices. Saving updates the linked customer
              record.
            </p>
            {fieldErrors.customer_email && (
              <p id="customer-email-error" className="mt-1 text-sm text-red-600" role="alert">
                {fieldErrors.customer_email}
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Job details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="title" className="block text-sm font-medium text-zinc-700">
              Job title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Kitchen renovation"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="scopeOfWork" className="block text-sm font-medium text-zinc-700">
              Scope of work <span className="text-red-500">*</span>
            </label>
            <textarea
              id="scopeOfWork"
              rows={4}
              value={scopeOfWork}
              onChange={(e) => {
                setScopeOfWork(e.target.value);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.scope_of_work;
                  return next;
                });
              }}
              placeholder="Describe exactly what work will be completed (e.g., install drywall, paint walls, replace flooring)"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              aria-invalid={!!fieldErrors.scope_of_work}
            />
            <p className="mt-1 text-xs text-zinc-500">
              This will be included in your contract and helps protect you in disputes.
            </p>
            {fieldErrors.scope_of_work && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {fieldErrors.scope_of_work}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="serviceCategory" className="block text-sm font-medium text-zinc-700">
              Trade <span className="text-red-500">*</span>
            </label>
            <input
              id="serviceCategory"
              type="text"
              required
              value={serviceCategory}
              onChange={(e) => {
                setServiceCategory(e.target.value);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.service_category;
                  return next;
                });
              }}
              placeholder="e.g. Electrical, Plumbing, Renovation"
              className={`mt-1 block w-full rounded-lg border px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#2436BB] ${
                fieldErrors.service_category ? "border-red-500 focus:border-red-500" : "border-zinc-300 focus:border-[#2436BB]"
              }`}
              aria-invalid={!!fieldErrors.service_category}
            />
            {fieldErrors.service_category && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {fieldErrors.service_category}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="propertyAddressLine1" className="block text-sm font-medium text-zinc-700">
              Property address line 1 <span className="text-red-500">*</span>
            </label>
            <input
              id="propertyAddressLine1"
              type="text"
              required
              value={propertyAddressLine1}
              onChange={(e) => setPropertyAddressLine1(e.target.value)}
              placeholder="123 Main St"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="propertyAddressLine2" className="block text-sm font-medium text-zinc-700">
              Property address line 2
            </label>
            <input
              id="propertyAddressLine2"
              type="text"
              value={propertyAddressLine2}
              onChange={(e) => setPropertyAddressLine2(e.target.value)}
              placeholder="Suite 100"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div>
            <label htmlFor="propertyCity" className="block text-sm font-medium text-zinc-700">
              City <span className="text-red-500">*</span>
            </label>
            <input
              id="propertyCity"
              type="text"
              required
              value={propertyCity}
              onChange={(e) => setPropertyCity(e.target.value)}
              placeholder="London"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div>
            <label htmlFor="propertyProvince" className="block text-sm font-medium text-zinc-700">
              Province <span className="text-red-500">*</span>
            </label>
            <input
              id="propertyProvince"
              type="text"
              required
              value={propertyProvince}
              onChange={(e) => setPropertyProvince(e.target.value)}
              placeholder="ON"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div>
            <label htmlFor="propertyPostalCode" className="block text-sm font-medium text-zinc-700">
              Postal code
            </label>
            <input
              id="propertyPostalCode"
              type="text"
              value={propertyPostalCode}
              onChange={(e) => setPropertyPostalCode(e.target.value)}
              placeholder="N6A 1B2"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div>
            <label htmlFor="depositAmount" className="block text-sm font-medium text-zinc-700">
              Deposit amount
            </label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-zinc-500">
                $
              </span>
              <input
                id="depositAmount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="no-spinner block w-full rounded-lg border border-zinc-300 py-2.5 pl-7 pr-4 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              />
            </div>
          </div>
          <div>
            <label htmlFor="taxRate" className="block text-sm font-medium text-zinc-700">
              Tax rate (e.g. 0.13 for 13%)
            </label>
            <input
              id="taxRate"
              type="number"
              step="0.0001"
              min="0"
              max="1"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              placeholder="0.13"
              className="no-spinner mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-zinc-700">
              Estimated start date <span className="text-red-500">*</span>
            </label>
            <input
              id="startDate"
              type="date"
              required
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.start_date;
                  delete next.estimated_completion_date;
                  return next;
                });
              }}
              className={`mt-1 block w-full rounded-lg border px-4 py-2.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#2436BB] ${
                fieldErrors.start_date ? "border-red-500 focus:border-red-500" : "border-zinc-300 focus:border-[#2436BB]"
              }`}
              aria-invalid={!!fieldErrors.start_date}
            />
            {fieldErrors.start_date && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {fieldErrors.start_date}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="estimatedCompletionDate" className="block text-sm font-medium text-zinc-700">
              Estimated completion date <span className="text-red-500">*</span>
            </label>
            <input
              id="estimatedCompletionDate"
              type="date"
              required
              min={startDate || undefined}
              value={estimatedCompletionDate}
              onChange={(e) => {
                setEstimatedCompletionDate(e.target.value);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.estimated_completion_date;
                  delete next.start_date;
                  return next;
                });
              }}
              className={`mt-1 block w-full rounded-lg border px-4 py-2.5 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#2436BB] ${
                fieldErrors.estimated_completion_date
                  ? "border-red-500 focus:border-red-500"
                  : "border-zinc-300 focus:border-[#2436BB]"
              }`}
              aria-invalid={!!fieldErrors.estimated_completion_date}
            />
            {fieldErrors.estimated_completion_date && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {fieldErrors.estimated_completion_date}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="originalContractPrice" className="block text-sm font-medium text-zinc-700">
              Contract price <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-zinc-500">
                $
              </span>
              <input
                id="originalContractPrice"
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={originalContractPrice}
                onChange={(e) => {
                  setOriginalContractPrice(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.original_contract_price;
                    return next;
                  });
                }}
                placeholder="0.00"
                className="no-spinner block w-full rounded-lg border border-zinc-300 py-2.5 pl-7 pr-4 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                aria-invalid={!!fieldErrors.original_contract_price}
              />
            </div>
            {fieldErrors.original_contract_price && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {fieldErrors.original_contract_price}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 sm:flex-row">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#2436BB] px-6 py-3 font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
        <Link
          href={`/jobs/${job.id}`}
          className="rounded-lg border border-zinc-300 px-6 py-3 text-center font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
