"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { updateProfileBusinessInfo } from "@/app/(app)/actions";
import { validateBusinessProfileFields } from "@/lib/validation/business-profile";
type Profile = {
  id: string;
  business_name: string | null;
  contractor_name: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  default_contract_payment_terms?: string | null;
  default_contract_terms_and_conditions?: string | null;
  default_contract_warranty_note?: string | null;
  default_contract_cancellation_note?: string | null;
  e_transfer_email?: string | null;
  business_contact_email?: string | null;
  invoice_reminders_enabled?: boolean | null;
  invoice_reminders_automation_paused?: boolean | null;
  invoice_remind_not_viewed_after_days?: number | null;
  invoice_remind_viewed_after_days?: number | null;
  invoice_remind_overdue_after_days?: number | null;
  invoice_repeat_overdue_every_days?: number | null;
} | null;

export function BusinessSettingsForm({
  profile,
  userEmail,
}: {
  profile: Profile;
  userEmail: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [businessName, setBusinessName] = useState(profile?.business_name ?? "");
  const [contractorName, setContractorName] = useState(profile?.contractor_name ?? "");
  const [businessContactEmail, setBusinessContactEmail] = useState(
    () => profile?.business_contact_email?.trim() || userEmail
  );
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [addressLine1, setAddressLine1] = useState(profile?.address_line_1 ?? "");
  const [addressLine2, setAddressLine2] = useState(profile?.address_line_2 ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [province, setProvince] = useState(profile?.province ?? "");
  const [postalCode, setPostalCode] = useState(profile?.postal_code ?? "");
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState(
    profile?.default_contract_payment_terms ?? ""
  );
  const [defaultTermsAndConditions, setDefaultTermsAndConditions] = useState(
    profile?.default_contract_terms_and_conditions ?? ""
  );
  const [defaultWarranty, setDefaultWarranty] = useState(
    profile?.default_contract_warranty_note ?? ""
  );
  const [defaultCancellation, setDefaultCancellation] = useState(
    profile?.default_contract_cancellation_note ?? ""
  );
  const [eTransferEmail, setETransferEmail] = useState(profile?.e_transfer_email ?? "");
  const [invRemEnabled, setInvRemEnabled] = useState(
    Boolean(profile?.invoice_reminders_enabled)
  );
  const [invRemPaused, setInvRemPaused] = useState(
    Boolean(profile?.invoice_reminders_automation_paused)
  );
  const [invNv, setInvNv] = useState(
    String(profile?.invoice_remind_not_viewed_after_days ?? 3)
  );
  const [invVw, setInvVw] = useState(
    String(profile?.invoice_remind_viewed_after_days ?? 5)
  );
  const [invOv, setInvOv] = useState(
    String(profile?.invoice_remind_overdue_after_days ?? 2)
  );
  const [invRep, setInvRep] = useState(
    String(profile?.invoice_repeat_overdue_every_days ?? 7)
  );
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!success) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    const t = window.setTimeout(() => {
      successRef.current?.focus();
    }, 350);
    return () => window.clearTimeout(t);
  }, [success]);

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const errs = validateBusinessProfileFields({
      business_name: businessName,
      account_email: userEmail,
      phone,
      address_line_1: addressLine1,
      city,
      province,
      postal_code: postalCode,
    });
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    const formData = new FormData();
    formData.set("business_name", businessName.trim());
    formData.set("contractor_name", contractorName.trim());
    formData.set("business_contact_email", businessContactEmail.trim());
    formData.set("phone", phone.trim());
    formData.set("address_line_1", addressLine1.trim());
    formData.set("address_line_2", addressLine2.trim());
    formData.set("city", city.trim());
    formData.set("province", province.trim());
    formData.set("postal_code", postalCode.trim());
    formData.set("default_contract_payment_terms", defaultPaymentTerms);
    formData.set("default_contract_terms_and_conditions", defaultTermsAndConditions);
    formData.set("default_contract_warranty_note", defaultWarranty);
    formData.set("default_contract_cancellation_note", defaultCancellation);
    formData.set("e_transfer_email", eTransferEmail.trim());
    formData.set("invoice_reminders_enabled", invRemEnabled ? "1" : "0");
    formData.set("invoice_reminders_automation_paused", invRemPaused ? "1" : "0");
    formData.set("invoice_remind_not_viewed_after_days", invNv.trim() || "3");
    formData.set("invoice_remind_viewed_after_days", invVw.trim() || "5");
    formData.set("invoice_remind_overdue_after_days", invOv.trim() || "2");
    formData.set("invoice_repeat_overdue_every_days", invRep.trim() || "7");

    const result = await updateProfileBusinessInfo(formData);

    setLoading(false);

    if (result && "fieldErrors" in result && result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    if (result?.error) {
      setError(result.error);
      return;
    }

    setSuccess(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <p className="text-sm text-zinc-600">
        This information will appear on your contracts and invoices and is required.
      </p>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div
          ref={successRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
        >
          Business settings saved successfully.
        </div>
      )}

      <div>
        <label htmlFor="businessName" className="block text-sm font-medium text-zinc-700">
          Business name <span className="text-red-500">*</span>
        </label>
        <input
          id="businessName"
          type="text"
          value={businessName}
          onChange={(e) => {
            setBusinessName(e.target.value);
            clearFieldError("business_name");
          }}
          placeholder="Acme Construction Ltd."
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
          aria-invalid={!!fieldErrors.business_name}
        />
        {fieldErrors.business_name && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {fieldErrors.business_name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="contractorName" className="block text-sm font-medium text-zinc-700">
          Contractor name (optional)
        </label>
        <input
          id="contractorName"
          type="text"
          value={contractorName}
          onChange={(e) => setContractorName(e.target.value)}
          placeholder="John Smith"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
        />
      </div>

      <div>
        <label htmlFor="businessContactEmail" className="block text-sm font-medium text-zinc-700">
          Business contact email
        </label>
        <input
          id="businessContactEmail"
          type="email"
          value={businessContactEmail}
          onChange={(e) => {
            setBusinessContactEmail(e.target.value);
            clearFieldError("business_contact_email");
          }}
          placeholder={userEmail || "you@example.com"}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
          aria-invalid={!!fieldErrors.business_contact_email}
        />
        {fieldErrors.business_contact_email && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {fieldErrors.business_contact_email}
          </p>
        )}
        <p className="mt-1 text-xs text-zinc-500">
          Shown on invoices, invoice emails, and the customer invoice page. Pre-filled from your login
          email; change it if customers should reach you at a different address.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-600">Login email</span> (account sign-in):{" "}
          <span className="text-zinc-700">{userEmail || "—"}</span>
        </p>
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-zinc-700">
          Phone <span className="text-red-500">*</span>
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            clearFieldError("phone");
          }}
          placeholder="(555) 123-4567"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
          aria-invalid={!!fieldErrors.phone}
        />
        {fieldErrors.phone && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {fieldErrors.phone}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="eTransferEmail" className="block text-sm font-medium text-zinc-700">
          E-transfer email (optional)
        </label>
        <input
          id="eTransferEmail"
          type="email"
          value={eTransferEmail}
          onChange={(e) => {
            setETransferEmail(e.target.value);
            clearFieldError("e_transfer_email");
          }}
          placeholder="payments@yourbusiness.ca"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
          aria-invalid={!!fieldErrors.e_transfer_email}
        />
        {fieldErrors.e_transfer_email && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {fieldErrors.e_transfer_email}
          </p>
        )}
        <p className="mt-1 text-xs text-zinc-500">
          Shown on invoices so customers know where to send Interac e-Transfers.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-900">Address</h3>
        <div className="mt-3 space-y-4">
          <div>
            <label htmlFor="addressLine1" className="block text-sm font-medium text-zinc-700">
              Address line 1 <span className="text-red-500">*</span>
            </label>
            <input
              id="addressLine1"
              type="text"
              value={addressLine1}
              onChange={(e) => {
                setAddressLine1(e.target.value);
                clearFieldError("address_line_1");
              }}
              placeholder="123 Main St"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              aria-invalid={!!fieldErrors.address_line_1}
            />
            {fieldErrors.address_line_1 && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {fieldErrors.address_line_1}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="addressLine2" className="block text-sm font-medium text-zinc-700">
              Address line 2
            </label>
            <input
              id="addressLine2"
              type="text"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Suite 100"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-zinc-700">
                City <span className="text-red-500">*</span>
              </label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  clearFieldError("city");
                }}
                placeholder="London"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                aria-invalid={!!fieldErrors.city}
              />
              {fieldErrors.city && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {fieldErrors.city}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="province" className="block text-sm font-medium text-zinc-700">
                Province <span className="text-red-500">*</span>
              </label>
              <input
                id="province"
                type="text"
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  clearFieldError("province");
                }}
                placeholder="ON"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                aria-invalid={!!fieldErrors.province}
              />
              {fieldErrors.province && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {fieldErrors.province}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="postalCode" className="block text-sm font-medium text-zinc-700">
                Postal code <span className="text-red-500">*</span>
              </label>
              <input
                id="postalCode"
                type="text"
                value={postalCode}
                onChange={(e) => {
                  setPostalCode(e.target.value);
                  clearFieldError("postal_code");
                }}
                placeholder="N6A 1B2"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                aria-invalid={!!fieldErrors.postal_code}
              />
              {fieldErrors.postal_code && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {fieldErrors.postal_code}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 pt-6">
        <h3 className="text-sm font-semibold text-zinc-900">Invoice reminder automation</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Optional automatic email reminders for unpaid invoices. Timing uses Eastern (Toronto) dates.
          Reminders never change invoice status and use cautious wording for customers.
        </p>
        <div className="mt-4 space-y-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={invRemEnabled}
              onChange={(e) => setInvRemEnabled(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-[#2436BB] focus:ring-[#2436BB]"
            />
            <span>
              <span className="block text-sm font-medium text-zinc-900">
                Enable automatic invoice reminders
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Off by default. When on, reminders can be sent automatically according to the rules
                below, if your deployment is set up for it.
              </span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-start gap-3 ${!invRemEnabled ? "opacity-50" : ""}`}
          >
            <input
              type="checkbox"
              checked={invRemPaused}
              disabled={!invRemEnabled}
              onChange={(e) => setInvRemPaused(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-[#2436BB] focus:ring-[#2436BB] disabled:cursor-not-allowed"
            />
            <span>
              <span className="block text-sm font-medium text-zinc-900">
                Pause automation (keep settings)
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Stops automated sends until you turn this off. Manual reminders still work.
              </span>
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="invNotViewed"
                className="block text-sm font-medium text-zinc-700"
              >
                Not viewed — remind after (days)
              </label>
              <input
                id="invNotViewed"
                type="number"
                min={1}
                max={365}
                disabled={!invRemEnabled}
                value={invNv}
                onChange={(e) => setInvNv(e.target.value)}
                className="mt-1 block w-full max-w-[11rem] rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100"
              />
              <p className="mt-1 text-xs text-zinc-500">
                After the invoice is sent, if the invoice has not yet been viewed.
              </p>
            </div>
            <div>
              <label htmlFor="invViewed" className="block text-sm font-medium text-zinc-700">
                Viewed, unpaid — remind after (days)
              </label>
              <input
                id="invViewed"
                type="number"
                min={1}
                max={365}
                disabled={!invRemEnabled}
                value={invVw}
                onChange={(e) => setInvVw(e.target.value)}
                className="mt-1 block w-full max-w-[11rem] rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100"
              />
              <p className="mt-1 text-xs text-zinc-500">
                After the customer opens the invoice page, if a balance remains.
              </p>
            </div>
            <div>
              <label htmlFor="invOverdue" className="block text-sm font-medium text-zinc-700">
                Past due — first reminder after (days)
              </label>
              <input
                id="invOverdue"
                type="number"
                min={1}
                max={365}
                disabled={!invRemEnabled}
                value={invOv}
                onChange={(e) => setInvOv(e.target.value)}
                className="mt-1 block w-full max-w-[11rem] rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Calendar days after the due date, if a balance remains.
              </p>
            </div>
            <div>
              <label htmlFor="invRepeat" className="block text-sm font-medium text-zinc-700">
                Still overdue — repeat every (days)
              </label>
              <input
                id="invRepeat"
                type="number"
                min={1}
                max={365}
                disabled={!invRemEnabled}
                value={invRep}
                onChange={(e) => setInvRep(e.target.value)}
                className="mt-1 block w-full max-w-[11rem] rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100"
              />
              <p className="mt-1 text-xs text-zinc-500">
                After a reminder was sent, minimum days before another (manual or automatic).
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 pt-6">
        <h3 className="text-sm font-semibold text-zinc-900">Contract defaults (optional)</h3>
        <p className="mt-1 text-sm text-zinc-600">
          When you start a new contract draft (no saved draft yet), these values pre-fill the contract
          builder. You can still edit them per job.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="defaultPaymentTerms"
              className="block text-sm font-medium text-zinc-700"
            >
              Default payment terms
            </label>
            <textarea
              id="defaultPaymentTerms"
              rows={3}
              value={defaultPaymentTerms}
              onChange={(e) => setDefaultPaymentTerms(e.target.value)}
              placeholder="e.g. 50% deposit on signing, balance on completion"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div>
            <label
              htmlFor="defaultTermsAndConditions"
              className="block text-sm font-medium text-zinc-700"
            >
              Default terms and conditions
            </label>
            <textarea
              id="defaultTermsAndConditions"
              rows={5}
              value={defaultTermsAndConditions}
              onChange={(e) => setDefaultTermsAndConditions(e.target.value)}
              placeholder="General terms, liability, dispute resolution..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div>
            <label
              htmlFor="defaultWarranty"
              className="block text-sm font-medium text-zinc-700"
            >
              Default warranty note
            </label>
            <textarea
              id="defaultWarranty"
              rows={3}
              value={defaultWarranty}
              onChange={(e) => setDefaultWarranty(e.target.value)}
              placeholder="Workmanship warranty terms..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
          <div>
            <label
              htmlFor="defaultCancellation"
              className="block text-sm font-medium text-zinc-700"
            >
              Default cancellation / changes note
            </label>
            <textarea
              id="defaultCancellation"
              rows={3}
              value={defaultCancellation}
              onChange={(e) => setDefaultCancellation(e.target.value)}
              placeholder="Policy for cancellations or change orders..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 border-t border-zinc-200 pt-6">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#2436BB] px-6 py-3 font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
