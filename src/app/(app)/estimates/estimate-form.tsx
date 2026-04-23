"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createEstimate,
  updateEstimateDraft,
  type EstimateDetail,
} from "@/app/(app)/estimates/estimate-actions";
import { parsePositiveContractPrice, validateScopeOfWork } from "@/lib/validation/job-create";
import { computeEstimateTotals } from "@/lib/estimate-pricing";
import { defaultTaxRateForNewFinancials } from "@/lib/tax/canada";
import { invoiceTaxRateDisplayLabel } from "@/lib/invoice-tax";

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

export function EstimateForm({
  customers,
  profileProvince,
  initialTaxRate,
  mode,
  estimateId,
  initial,
}: {
  customers: Customer[];
  profileProvince: string | null;
  initialTaxRate: string;
  mode: "create" | "edit";
  estimateId?: string;
  initial?: EstimateDetail | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [useNewCustomer, setUseNewCustomer] = useState(() =>
    mode === "create" ? customers.length === 0 : false
  );

  const [customerName, setCustomerName] = useState(
    () => initial?.customers?.full_name ?? ""
  );
  const [customerEmail, setCustomerEmail] = useState(
    () => initial?.customers?.email ?? ""
  );
  const [customerPhone, setCustomerPhone] = useState(
    () => initial?.customers?.phone ?? ""
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    () => initial?.customer_id ?? customers[0]?.id ?? ""
  );
  const [existingCustomerPhone, setExistingCustomerPhone] = useState(
    () =>
      initial?.customers?.phone?.trim() ??
      customers.find((c) => c.id === initial?.customer_id)?.phone?.trim() ??
      ""
  );

  const [title, setTitle] = useState(() => initial?.title ?? "");
  const [scopeOfWork, setScopeOfWork] = useState(() => initial?.scope_of_work ?? "");
  const [propertyAddressLine1, setPropertyAddressLine1] = useState(
    () => initial?.property_address_line_1 ?? ""
  );
  const [propertyAddressLine2, setPropertyAddressLine2] = useState(
    () => initial?.property_address_line_2 ?? ""
  );
  const [propertyCity, setPropertyCity] = useState(() => initial?.property_city ?? "");
  const [propertyProvince, setPropertyProvince] = useState(
    () => initial?.property_province ?? ""
  );
  const [propertyPostalCode, setPropertyPostalCode] = useState(
    () => initial?.property_postal_code ?? ""
  );
  const [subtotal, setSubtotal] = useState(() =>
    initial?.subtotal != null ? String(initial.subtotal) : ""
  );
  const [taxRate, setTaxRate] = useState(() =>
    initial?.tax_rate != null ? String(initial.tax_rate) : initialTaxRate
  );
  const [depositAmount, setDepositAmount] = useState(() =>
    initial?.deposit_amount != null ? String(initial.deposit_amount) : ""
  );
  const [expiryDate, setExpiryDate] = useState(() => initial?.expiry_date ?? "");
  const [notes, setNotes] = useState(() => initial?.notes ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const taxPreview = (() => {
    const sub = parseFloat(subtotal);
    const rate = parseFloat(taxRate);
    if (!Number.isFinite(sub) || sub < 0 || !Number.isFinite(rate) || rate < 0) {
      return { taxAmount: 0, total: 0 };
    }
    return computeEstimateTotals(sub, rate);
  })();

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const scopeErr = validateScopeOfWork(scopeOfWork);
    if (scopeErr) errs.scope_of_work = scopeErr;
    const priceRes = parsePositiveContractPrice(subtotal);
    if (!priceRes.ok) errs.subtotal = priceRes.message;
    if (useNewCustomer) {
      if (!customerName.trim()) errs.customer_full_name = "Name is required.";
      if (!customerEmail.trim()) errs.customer_email = "Email is required.";
      if (!customerPhone.trim()) errs.customer_phone = "Phone is required.";
    } else {
      if (!selectedCustomerId) errs.customer_selection = "Select a customer.";
    }
    if (!propertyAddressLine1.trim()) errs.property_address_line_1 = "Required.";
    if (!propertyCity.trim()) errs.property_city = "Required.";
    if (!propertyProvince.trim()) errs.property_province = "Required.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("use_new_customer", useNewCustomer ? "1" : "0");
      fd.set("title", title.trim());
      fd.set("scope_of_work", scopeOfWork.trim());
      fd.set("property_address_line_1", propertyAddressLine1.trim());
      fd.set("property_address_line_2", propertyAddressLine2.trim());
      fd.set("property_city", propertyCity.trim());
      fd.set("property_province", propertyProvince.trim());
      fd.set("property_postal_code", propertyPostalCode.trim());
      fd.set("subtotal", subtotal.trim());
      fd.set("tax_rate", taxRate.trim());
      fd.set("deposit_amount", depositAmount.trim());
      fd.set("expiry_date", expiryDate.trim());
      fd.set("notes", notes.trim());
      if (useNewCustomer) {
        fd.set("customer_full_name", customerName.trim());
        fd.set("customer_email", customerEmail.trim());
        fd.set("customer_phone", customerPhone.trim());
      } else {
        fd.set("customer_id", selectedCustomerId);
        fd.set("existing_customer_phone", existingCustomerPhone.trim());
      }

      if (mode === "create") {
        const res = await createEstimate(fd);
        if ("error" in res && res.error) {
          setError(res.error);
          return;
        }
        if ("fieldErrors" in res && res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
          return;
        }
        router.push(`/estimates/${(res as { estimateId: string }).estimateId}`);
        return;
      }

      if (!estimateId) {
        setError("Missing estimate.");
        return;
      }
      const res = await updateEstimateDraft(estimateId, fd);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("fieldErrors" in res && res.fieldErrors) {
        setFieldErrors(res.fieldErrors);
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const taxHint = invoiceTaxRateDisplayLabel(
    propertyProvince.trim() || profileProvince
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Customer</h2>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="customerMode"
              checked={!useNewCustomer}
              onChange={() => setUseNewCustomer(false)}
              className="h-4 w-4 border-zinc-300 text-[#2436BB] focus:ring-[#2436BB]"
            />
            <span className="text-sm text-zinc-700">Select existing</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="customerMode"
              checked={useNewCustomer}
              onChange={() => setUseNewCustomer(true)}
              className="h-4 w-4 border-zinc-300 text-[#2436BB] focus:ring-[#2436BB]"
            />
            <span className="text-sm text-zinc-700">Create new</span>
          </label>
        </div>

        {useNewCustomer ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                required={useNewCustomer}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              />
              {fieldErrors.customer_full_name && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.customer_full_name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              />
              {fieldErrors.customer_email && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.customer_email}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required={useNewCustomer}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              />
              {fieldErrors.customer_phone && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.customer_phone}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedCustomerId(id);
                  const sel = customers.find((x) => x.id === id);
                  setExistingCustomerPhone(sel?.phone?.trim() ?? "");
                }}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              >
                <option value="">Select a customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                    {c.email ? ` (${c.email})` : ""}
                  </option>
                ))}
              </select>
              {fieldErrors.customer_selection && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.customer_selection}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Customer phone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={existingCustomerPhone}
                onChange={(e) => setExistingCustomerPhone(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              />
              {fieldErrors.customer_phone && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.customer_phone}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Estimate details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700">
              Scope of work <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
            {fieldErrors.scope_of_work && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.scope_of_work}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700">
              Property address line 1 <span className="text-red-500">*</span>
            </label>
            <input
              value={propertyAddressLine1}
              onChange={(e) => setPropertyAddressLine1(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
            {fieldErrors.property_address_line_1 && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.property_address_line_1}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700">Property address line 2</label>
            <input
              value={propertyAddressLine2}
              onChange={(e) => setPropertyAddressLine2(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              City <span className="text-red-500">*</span>
            </label>
            <input
              value={propertyCity}
              onChange={(e) => setPropertyCity(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
            {fieldErrors.property_city && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.property_city}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Province <span className="text-red-500">*</span>
            </label>
            <input
              value={propertyProvince}
              onChange={(e) => {
                setPropertyProvince(e.target.value);
                const d = defaultTaxRateForNewFinancials(
                  profileProvince,
                  e.target.value.trim() || null
                );
                setTaxRate(String(d.taxRate));
              }}
              placeholder="ON"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
            {fieldErrors.property_province && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.property_province}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Postal code</label>
            <input
              value={propertyPostalCode}
              onChange={(e) => setPropertyPostalCode(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Pricing</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Subtotal is before tax. Tax rate defaults from the job site province when set.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Subtotal (before tax) <span className="text-red-500">*</span>
            </label>
            <input
              inputMode="decimal"
              value={subtotal}
              onChange={(e) => setSubtotal(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
            {fieldErrors.subtotal && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.subtotal}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Tax rate (decimal)</label>
            <input
              inputMode="decimal"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
            <p className="mt-1 text-xs text-zinc-500">{taxHint}</p>
          </div>
          <div className="sm:col-span-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            <p>
              Tax:{" "}
              <span className="font-semibold tabular-nums">${taxPreview.taxAmount.toFixed(2)}</span> ·
              Total:{" "}
              <span className="font-semibold tabular-nums">${taxPreview.total.toFixed(2)}</span>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Suggested deposit</label>
            <input
              inputMode="decimal"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Valid until (optional)</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
            <p className="mt-1 text-xs text-zinc-500">Dates use your local picker; expiry is evaluated in Eastern time.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex rounded-lg bg-[#2436BB] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-60"
        >
          {loading ? "Saving…" : mode === "create" ? "Create draft" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
