"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
} | null;

export function OnboardingBusinessForm({
  profile,
  userEmail,
  confirmed,
}: {
  profile: Profile;
  userEmail: string;
  confirmed: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [businessName, setBusinessName] = useState(profile?.business_name ?? "");
  const [contractorName, setContractorName] = useState(profile?.contractor_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [addressLine1, setAddressLine1] = useState(profile?.address_line_1 ?? "");
  const [addressLine2, setAddressLine2] = useState(profile?.address_line_2 ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [province, setProvince] = useState(profile?.province ?? "");
  const [postalCode, setPostalCode] = useState(profile?.postal_code ?? "");

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
    formData.set("phone", phone.trim());
    formData.set("address_line_1", addressLine1.trim());
    formData.set("address_line_2", addressLine2.trim());
    formData.set("city", city.trim());
    formData.set("province", province.trim());
    formData.set("postal_code", postalCode.trim());

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

    router.push("/dashboard?onboarded=true");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <p className="text-sm text-zinc-600">
        This information will appear on your contracts and invoices and is required.
      </p>

      {confirmed && (
        <div
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          role="status"
        >
          Your email has been confirmed. Your account is ready to use.
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
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
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          type="email"
          value={userEmail}
          disabled
          className="mt-1 block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-zinc-600"
          aria-invalid={!!fieldErrors.account_email}
        />
        {fieldErrors.account_email && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {fieldErrors.account_email}
          </p>
        )}
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

      <div className="space-y-4">
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

      <div className="border-t border-zinc-200 pt-6">
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#2436BB] px-4 py-3 font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Saving..." : "Save and continue"}
        </button>
      </div>
    </form>
  );
}
