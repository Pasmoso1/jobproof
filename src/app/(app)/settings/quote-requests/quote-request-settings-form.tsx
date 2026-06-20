"use client";

import { useState } from "react";
import {
  QUOTE_PRICING_PROFILES,
  QUOTE_PRIMARY_TRADES,
  pricingProfileLabel,
} from "@/lib/quote-requests/constants";
import { suggestQuoteSlugFromBusinessName } from "@/lib/quote-requests/slug";
import { updateQuoteRequestSettings } from "./actions";

type ProfileFields = {
  quote_slug?: string | null;
  business_name?: string | null;
  phone?: string | null;
  quote_logo_url?: string | null;
  quote_pricing_profile?: string | null;
  quote_primary_trade?: string | null;
};

export function QuoteRequestSettingsForm({
  profile,
  appOrigin,
}: {
  profile: ProfileFields | null;
  appOrigin: string;
}) {
  const [quoteSlug, setQuoteSlug] = useState(profile?.quote_slug ?? "");
  const [businessName, setBusinessName] = useState(profile?.business_name ?? "");
  const [businessPhone, setBusinessPhone] = useState(profile?.phone ?? "");
  const [logoUrl, setLogoUrl] = useState(profile?.quote_logo_url ?? "");
  const [pricingProfile, setPricingProfile] = useState(
    profile?.quote_pricing_profile ?? "average"
  );
  const [primaryTrade, setPrimaryTrade] = useState(profile?.quote_primary_trade ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function suggestSlug() {
    if (businessName.trim()) {
      setQuoteSlug(suggestQuoteSlugFromBusinessName(businessName));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSuccess(false);
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const result = await updateQuoteRequestSettings(formData);
      if (!result.success) {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  }

  const publicUrl = quoteSlug.trim()
    ? `${appOrigin.replace(/\/$/, "")}/quote/${quoteSlug.trim().toLowerCase()}`
    : null;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6 rounded-xl border border-zinc-200 bg-white p-5">
      {success ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Quote request settings saved.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-zinc-800">
          Quote page URL
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center rounded-lg border border-zinc-300 bg-zinc-50">
              <span className="shrink-0 pl-3 text-sm text-zinc-500">/quote/</span>
              <input
                name="quoteSlug"
                value={quoteSlug}
                onChange={(e) => setQuoteSlug(e.target.value)}
                required
                placeholder="your-business"
                className="min-w-0 flex-1 border-0 bg-transparent py-2 pr-3 text-sm focus:ring-0"
              />
            </div>
            <button
              type="button"
              onClick={suggestSlug}
              className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Suggest from name
            </button>
          </div>
        </label>
        {fieldErrors.quoteSlug ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.quoteSlug}</p>
        ) : null}
        {publicUrl ? (
          <p className="mt-2 text-xs text-zinc-600">
            Public link:{" "}
            <a href={publicUrl} className="font-medium text-[#2436BB] hover:underline" target="_blank" rel="noreferrer">
              {publicUrl}
            </a>
          </p>
        ) : null}
      </div>

      <label className="block">
        <span className="text-sm font-medium text-zinc-800">Business name</span>
        <input
          name="businessName"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        {fieldErrors.businessName ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.businessName}</p>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-800">Business phone</span>
        <input
          name="businessPhone"
          value={businessPhone}
          onChange={(e) => setBusinessPhone(e.target.value)}
          required
          type="tel"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        {fieldErrors.businessPhone ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.businessPhone}</p>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-800">Logo URL</span>
        <input
          name="logoUrl"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          type="url"
          placeholder="https://…"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-zinc-500">Optional. Shown at the top of your public quote page.</p>
        {fieldErrors.logoUrl ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.logoUrl}</p>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-800">Pricing profile</span>
        <select
          name="pricingProfile"
          value={pricingProfile}
          onChange={(e) => setPricingProfile(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          {QUOTE_PRICING_PROFILES.map((p) => (
            <option key={p} value={p}>
              {pricingProfileLabel(p)}
            </option>
          ))}
        </select>
        {fieldErrors.pricingProfile ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.pricingProfile}</p>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-800">Primary trade</span>
        <select
          name="primaryTrade"
          value={primaryTrade}
          onChange={(e) => setPrimaryTrade(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Select a trade…</option>
          {QUOTE_PRIMARY_TRADES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {fieldErrors.primaryTrade ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.primaryTrade}</p>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96] disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save quote settings"}
      </button>
    </form>
  );
}
