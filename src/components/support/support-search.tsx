"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { searchSupportContent } from "@/lib/support/catalog";
import { categoryLabel } from "@/lib/support/types";

export function SupportSearch({
  autoFocus = false,
  compact = false,
}: {
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchSupportContent(query), [query]);
  const showResults = query.trim().length > 0;

  return (
    <div className="relative w-full">
      <label htmlFor="support-search" className="sr-only">
        How can we help?
      </label>
      <input
        id="support-search"
        type="search"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="How can we help?"
        className={
          compact
            ? "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-[#2436BB] placeholder:text-zinc-400 focus:ring-2"
            : "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-base text-zinc-900 shadow-sm outline-none ring-[#2436BB] placeholder:text-zinc-400 focus:ring-2 sm:py-4 sm:text-lg"
        }
      />
      {showResults ? (
        <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-600">No matches. Try different keywords.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 py-1">
              {results.map((hit) => (
                <li key={hit.kind === "article" ? hit.slug : hit.id}>
                  <Link
                    href={hit.href}
                    className="block px-4 py-3 hover:bg-zinc-50"
                    onClick={() => setQuery("")}
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {hit.kind === "article" ? categoryLabel(hit.category) : "FAQ"}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-zinc-900">{hit.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-zinc-600">{hit.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
