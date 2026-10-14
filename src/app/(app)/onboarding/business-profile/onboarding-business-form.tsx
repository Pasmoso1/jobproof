"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BUSINESS_NAME_MAX_LENGTH,
  validateOnboardingBusinessName,
} from "@/lib/validation/business-profile";
import { normalizeAdditionalTrades } from "@/lib/quote-requests/trade";
import { ContractorTradesServicesFields } from "@/components/contractor/contractor-trades-services-fields";
import {
  GA4_FUNNEL_EVENTS,
  buildAcquisitionContext,
  trackGa4EventOnce,
} from "@/lib/ga4";
import { readFirstTouchClient } from "@/lib/attribution-first-touch";
import { readPartnerRefClient } from "@/lib/partners/partner-ref-cookie";
import { completeOnboardingBusinessSetup } from "./actions";

type Profile = {
  id: string;
  business_name: string | null;
  quote_primary_trade?: string | null;
  quote_primary_trade_other?: string | null;
  quote_additional_trades?: string[] | null;
  contractor_extra_capabilities?: string | null;
} | null;

const INPUT_CLASS =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]";

export function OnboardingBusinessForm({
  profile,
  confirmed,
  redirectTo,
  startsTrial = true,
  maxTotalTrades = 2,
}: {
  profile: Profile;
  confirmed: boolean;
  redirectTo: string;
  /** False for accounts whose trial or subscription already exists (profile fix-up only). */
  startsTrial?: boolean;
  maxTotalTrades?: number | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Not cleared on success: the form stays locked until the dashboard replaces this page.
  const [saving, setSaving] = useState(false);
  const [isNavigating, startTransition] = useTransition();
  const inFlight = useRef(false);
  const busy = saving || isNavigating;
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [businessName, setBusinessName] = useState(profile?.business_name ?? "");
  const [primaryTrade, setPrimaryTrade] = useState(profile?.quote_primary_trade ?? "");
  const [primaryTradeOther, setPrimaryTradeOther] = useState(
    profile?.quote_primary_trade_other ?? ""
  );
  const [additionalTrades, setAdditionalTrades] = useState<string[]>(
    normalizeAdditionalTrades(profile?.quote_additional_trades)
  );

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || inFlight.current) return;
    setError(null);

    const errs: Record<string, string> = {};
    const nameError = validateOnboardingBusinessName(businessName);
    if (nameError) errs.business_name = nameError;
    if (!primaryTrade.trim()) errs.primaryTrade = "Select a primary trade.";
    else if (primaryTrade === "Other" && !primaryTradeOther.trim()) {
      errs.primaryTradeOther = "Please specify your trade.";
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    inFlight.current = true;
    setSaving(true);

    const formData = new FormData();
    formData.set("business_name", businessName.trim());
    formData.set("primaryTrade", primaryTrade.trim());
    formData.set("primaryTradeOther", primaryTradeOther.trim());
    formData.set("redirect", redirectTo);

    let result: Awaited<ReturnType<typeof completeOnboardingBusinessSetup>>;
    try {
      result = await completeOnboardingBusinessSetup(formData);
    } catch {
      result = {
        success: false,
        error: "Could not save your business details. Please check your connection and try again.",
      };
    }

    if (!result.success) {
      inFlight.current = false;
      setSaving(false);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      if (result.error) setError(result.error);
      return;
    }

    // Initial onboarding only — settings/business edits use a different form.
    trackGa4EventOnce(
      "onboarding_complete",
      GA4_FUNNEL_EVENTS.onboarding_complete,
      {
        ...buildAcquisitionContext({
          firstTouch: readFirstTouchClient(),
          partnerReferralPresent: Boolean(readPartnerRefClient()),
        }),
        completion_step: "business_profile",
      }
    );

    startTransition(() => {
      router.push(result.redirectTo);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={busy}
      className="space-y-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"
    >
      {confirmed && (
        <div
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
          role="status"
        >
          Your email has been confirmed.
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="businessName" className="block text-sm font-medium text-zinc-800">
          Business name
        </label>
        <input
          id="businessName"
          name="business_name"
          type="text"
          autoComplete="organization"
          required
          maxLength={BUSINESS_NAME_MAX_LENGTH}
          value={businessName}
          onChange={(e) => {
            setBusinessName(e.target.value);
            clearFieldError("business_name");
          }}
          placeholder="Acme Renovations"
          className={INPUT_CLASS}
          aria-invalid={!!fieldErrors.business_name}
          aria-describedby={fieldErrors.business_name ? "businessName-error" : undefined}
        />
        {fieldErrors.business_name && (
          <p id="businessName-error" className="mt-1 text-sm text-red-600" role="alert">
            {fieldErrors.business_name}
          </p>
        )}
      </div>

      <ContractorTradesServicesFields
        primaryOnly
        primaryTrade={primaryTrade}
        primaryTradeOther={primaryTradeOther}
        additionalTrades={additionalTrades}
        contractorExtraCapabilities={profile?.contractor_extra_capabilities ?? ""}
        onPrimaryTradeChange={(value) => {
          setPrimaryTrade(value);
          clearFieldError("primaryTrade");
        }}
        onPrimaryTradeOtherChange={(value) => {
          setPrimaryTradeOther(value);
          clearFieldError("primaryTradeOther");
        }}
        onAdditionalTradesChange={setAdditionalTrades}
        onContractorExtraCapabilitiesChange={() => {}}
        fieldErrors={fieldErrors}
        primaryTradeRequired
        maxTotalTrades={maxTotalTrades}
        inputClassName={INPUT_CLASS}
        selectClassName={INPUT_CLASS}
      />

      <div className="pt-1">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#2436BB] px-4 text-base font-semibold text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? (
            <>
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                aria-hidden="true"
              />
              <span>{startsTrial ? "Starting your trial…" : "Saving…"}</span>
            </>
          ) : startsTrial ? (
            "Start my 14-day free trial"
          ) : (
            "Save and continue"
          )}
        </button>
        {startsTrial ? (
          <p className="mt-2 text-center text-xs text-zinc-500">No credit card required.</p>
        ) : null}
      </div>
    </form>
  );
}
