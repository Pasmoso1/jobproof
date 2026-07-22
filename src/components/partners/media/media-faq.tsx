import type { MediaFaqItem } from "@/lib/partners/media-center-content";

export function MediaFaq({ items }: { items: MediaFaqItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <details
          key={item.question}
          className="group rounded-xl border border-zinc-200 bg-white p-4 shadow-sm open:shadow-md"
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900 marker:content-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            <span className="flex items-start justify-between gap-3">
              <span>{item.question}</span>
              <span
                className="shrink-0 text-zinc-400 transition group-open:rotate-45"
                aria-hidden="true"
              >
                +
              </span>
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
