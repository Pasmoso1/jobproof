"use client";

import { StudioIcon } from "@/components/partners/studio/studio-icon";

export function StudioSelectCard({
  title,
  description,
  icon,
  selected,
  onSelect,
  multi = false,
}: {
  title: string;
  description: string;
  icon: string;
  selected: boolean;
  onSelect: () => void;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-[5.5rem] w-full flex-col rounded-2xl border p-4 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 ${
        selected
          ? "border-[#2436BB] bg-[#2436BB]/5 ring-1 ring-[#2436BB]"
          : "border-zinc-200 bg-white hover:border-zinc-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            selected ? "bg-[#2436BB] text-white" : "bg-zinc-100 text-[#2436BB]"
          }`}
        >
          <StudioIcon name={icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-900">{title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-zinc-600">
            {description}
          </span>
        </span>
        <span
          className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            selected
              ? "border-[#2436BB] bg-[#2436BB] text-white"
              : "border-zinc-300 bg-white"
          }`}
          aria-hidden="true"
        >
          {selected ? (
            multi ? (
              <span className="text-[10px] font-bold">✓</span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-white" />
            )
          ) : null}
        </span>
      </div>
    </button>
  );
}
