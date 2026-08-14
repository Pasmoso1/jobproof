"use client";

import { PARTNER_TYPES, type PartnerTypeValue } from "@/lib/partners/constants";

export function PartnerTypeCards({
  value,
  onChange,
  name = "partner_type",
  error,
}: {
  value: PartnerTypeValue | "";
  onChange: (value: PartnerTypeValue) => void;
  name?: string;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-zinc-700">
        What type of partner are you? <span className="text-red-500">*</span>
      </legend>
      <input type="hidden" name={name} value={value} required />
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {PARTNER_TYPES.map((type) => {
          const selected = value === type.value;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => onChange(type.value)}
              aria-pressed={selected}
              className={`rounded-2xl border p-4 text-left shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2436BB] ${
                selected
                  ? "border-[#2436BB] bg-[#2436BB]/5 ring-2 ring-[#2436BB]"
                  : "border-zinc-200 bg-white hover:border-[#2436BB]/40"
              }`}
            >
              <p className="text-sm font-semibold text-zinc-950">{type.label}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                {type.applyHint}
              </p>
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </fieldset>
  );
}
