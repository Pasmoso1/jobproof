"use client";

import {
  QUOTE_ADDITIONAL_TRADE_OPTIONS,
  QUOTE_PRIMARY_TRADES,
} from "@/lib/quote-requests/constants";
import { ContractorExtraCapabilitiesField } from "@/components/contractor/contractor-extra-capabilities-field";
import {
  countTotalTrades,
  SOLO_TRADE_LIMIT_UPGRADE_MESSAGE,
} from "@/lib/plan-entitlements";

const FIELD_INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 sm:text-sm";
const FIELD_SELECT_CLASS =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 sm:text-sm";

export type ContractorTradesProfileFields = {
  quote_primary_trade?: string | null;
  quote_primary_trade_other?: string | null;
  quote_additional_trades?: string[] | null;
  contractor_extra_capabilities?: string | null;
};

type ContractorTradesServicesFieldsProps = {
  primaryTrade: string;
  primaryTradeOther: string;
  additionalTrades: string[];
  contractorExtraCapabilities: string;
  onPrimaryTradeChange: (value: string) => void;
  onPrimaryTradeOtherChange: (value: string) => void;
  onAdditionalTradesChange: (value: string[]) => void;
  onContractorExtraCapabilitiesChange: (value: string) => void;
  fieldErrors?: Record<string, string>;
  primaryTradeRequired?: boolean;
  inputClassName?: string;
  selectClassName?: string;
  /** Max primary + additional trades; null = unlimited (Pro). */
  maxTotalTrades?: number | null;
};

export function ContractorTradesServicesFields({
  primaryTrade,
  primaryTradeOther,
  additionalTrades,
  contractorExtraCapabilities,
  onPrimaryTradeChange,
  onPrimaryTradeOtherChange,
  onAdditionalTradesChange,
  onContractorExtraCapabilitiesChange,
  fieldErrors = {},
  primaryTradeRequired = true,
  inputClassName = FIELD_INPUT_CLASS,
  selectClassName = FIELD_SELECT_CLASS,
  maxTotalTrades = null,
}: ContractorTradesServicesFieldsProps) {
  const additionalOptions = QUOTE_ADDITIONAL_TRADE_OPTIONS.filter(
    (trade) => trade !== primaryTrade
  );

  const totalSelected = countTotalTrades(primaryTrade, additionalTrades);
  const atPlanLimit =
    maxTotalTrades !== null && totalSelected >= maxTotalTrades;
  const isSoloLimited = maxTotalTrades !== null;

  function toggleAdditionalTrade(trade: string) {
    if (additionalTrades.includes(trade)) {
      onAdditionalTradesChange(additionalTrades.filter((t) => t !== trade));
      return;
    }
    if (atPlanLimit) return;
    onAdditionalTradesChange([...additionalTrades, trade]);
  }

  function onPrimaryChange(value: string) {
    onPrimaryTradeChange(value);
    if (value !== "Other") {
      onPrimaryTradeOtherChange("");
    }
    if (value) {
      onAdditionalTradesChange(additionalTrades.filter((t) => t !== value));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Trades &amp; Services</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Your trades and services help JobProof match quote requests to the work you actually
          perform.
        </p>
        {isSoloLimited ? (
          <p className="mt-2 text-xs font-medium text-zinc-700">
            {maxTotalTrades} trades included
            {totalSelected > 0 ? ` · ${totalSelected} selected` : ""}
          </p>
        ) : null}
      </div>

      <label className="block">
        <span className="text-sm font-medium text-zinc-800">
          Primary trade
          {primaryTradeRequired ? null : (
            <span className="font-normal text-zinc-500"> (optional)</span>
          )}
        </span>
        <select
          name="primaryTrade"
          value={primaryTrade}
          onChange={(e) => onPrimaryChange(e.target.value)}
          required={primaryTradeRequired}
          className={selectClassName}
        >
          <option value="" className="text-zinc-900">
            Select a trade…
          </option>
          {QUOTE_PRIMARY_TRADES.map((t) => (
            <option key={t} value={t} className="text-zinc-900">
              {t}
            </option>
          ))}
        </select>
        {fieldErrors.primaryTrade ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.primaryTrade}</p>
        ) : null}
      </label>

      {primaryTrade === "Other" ? (
        <label className="block">
          <span className="text-sm font-medium text-zinc-800">Please specify your trade</span>
          <input
            name="primaryTradeOther"
            value={primaryTradeOther}
            onChange={(e) => onPrimaryTradeOtherChange(e.target.value)}
            required={primaryTradeRequired}
            maxLength={80}
            placeholder="Custom Home Builder, Masonry, Pool Installer…"
            className={inputClassName}
          />
          {fieldErrors.primaryTradeOther ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.primaryTradeOther}</p>
          ) : null}
        </label>
      ) : null}

      <fieldset className="block">
        <legend className="text-sm font-medium text-zinc-800">
          Additional trades{" "}
          <span className="font-normal text-zinc-500">(optional)</span>
        </legend>
        <p className="mt-1 text-xs text-zinc-500">
          Select every other trade you regularly perform. Shown only to JobProof for matching — not
          on your public quote page.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {additionalOptions.map((trade) => {
            const checked = additionalTrades.includes(trade);
            const disabled = !checked && atPlanLimit;
            return (
              <label
                key={trade}
                className={`flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 ${
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:bg-zinc-50"
                }`}
              >
                <input
                  type="checkbox"
                  name="additionalTrades"
                  value={trade}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleAdditionalTrade(trade)}
                  className="h-4 w-4 rounded border-zinc-300 text-[#2436BB] focus:ring-[#2436BB]"
                />
                <span>{trade}</span>
              </label>
            );
          })}
        </div>
        {atPlanLimit ? (
          <p className="mt-2 text-xs text-[#2436BB]">{SOLO_TRADE_LIMIT_UPGRADE_MESSAGE}</p>
        ) : null}
        {fieldErrors.additionalTrades ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.additionalTrades}</p>
        ) : null}
      </fieldset>

      <ContractorExtraCapabilitiesField
        value={contractorExtraCapabilities}
        onChange={onContractorExtraCapabilitiesChange}
        fieldError={fieldErrors.contractorExtraCapabilities}
        inputClassName={inputClassName}
      />
    </div>
  );
}
