"use client";

import { useMemo, useState } from "react";
import type { SupportFaq } from "@/lib/support/types";

export function SupportFaqList({ faqs }: { faqs: SupportFaq[] }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter((f) => {
      const blob = `${f.question} ${f.answer} ${f.keywords.join(" ")}`.toLowerCase();
      return blob.includes(q);
    });
  }, [faqs, query]);

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search FAQs…"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-[#2436BB] placeholder:text-zinc-400 focus:ring-2"
      />
      <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-600">No FAQs match that search.</p>
        ) : (
          filtered.map((faq) => {
            const open = openId === faq.id;
            return (
              <div key={faq.id} id={faq.id} className="scroll-mt-24">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : faq.id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left hover:bg-zinc-50"
                >
                  <span className="text-sm font-semibold text-zinc-900 sm:text-base">
                    {faq.question}
                  </span>
                  <span className="shrink-0 text-zinc-400" aria-hidden>
                    {open ? "−" : "+"}
                  </span>
                </button>
                {open ? (
                  <div className="border-t border-zinc-100 px-4 pb-4 pt-1 text-sm leading-relaxed text-zinc-700">
                    {faq.answer}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
