"use client";

import {
  CONTRACTOR_EXTRA_CAPABILITIES_HELP,
  CONTRACTOR_EXTRA_CAPABILITIES_LABEL,
  CONTRACTOR_EXTRA_CAPABILITIES_MAX_LENGTH,
  CONTRACTOR_EXTRA_CAPABILITIES_PLACEHOLDER,
} from "@/lib/validation/contractor-extra-capabilities";

const FIELD_TEXTAREA_CLASS =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 sm:text-sm";

type ContractorExtraCapabilitiesFieldProps = {
  value: string;
  onChange: (value: string) => void;
  fieldError?: string;
  inputClassName?: string;
};

export function ContractorExtraCapabilitiesField({
  value,
  onChange,
  fieldError,
  inputClassName = FIELD_TEXTAREA_CLASS,
}: ContractorExtraCapabilitiesFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-800">{CONTRACTOR_EXTRA_CAPABILITIES_LABEL}</span>
      <textarea
        name="contractor_extra_capabilities"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={CONTRACTOR_EXTRA_CAPABILITIES_MAX_LENGTH}
        rows={3}
        placeholder={CONTRACTOR_EXTRA_CAPABILITIES_PLACEHOLDER}
        className={inputClassName}
      />
      <p className="mt-1 text-xs text-zinc-500">{CONTRACTOR_EXTRA_CAPABILITIES_HELP}</p>
      {fieldError ? <p className="mt-1 text-xs text-red-600">{fieldError}</p> : null}
    </label>
  );
}
