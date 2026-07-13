"use client";

import { CANADIAN_PROVINCES, provinceSelectValue } from "@/lib/canada/provinces";

type ProvinceSelectProps = {
  id: string;
  name?: string;
  value: string;
  onChange: (fullProvinceName: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
};

/**
 * Standardized Canadian province/territory dropdown.
 * Stores and emits full province names (not abbreviations).
 */
export function ProvinceSelect({
  id,
  name,
  value,
  onChange,
  required,
  disabled,
  className,
  "aria-invalid": ariaInvalid,
}: ProvinceSelectProps) {
  const selectValue = provinceSelectValue(value);
  return (
    <select
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      value={selectValue}
      aria-invalid={ariaInvalid}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
      }
    >
      <option value="">Select province or territory</option>
      {CANADIAN_PROVINCES.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}
