import Link from "next/link";
import {
  isAttentionActive,
  type AttentionItem,
  type AttentionSeverity,
} from "@/lib/admin/overview-metrics";

const SEVERITY: Record<
  AttentionSeverity,
  { label: string; card: string; pill: string; count: string }
> = {
  urgent: {
    label: "Urgent",
    card: "border-red-200 bg-red-50/60",
    pill: "bg-red-100 text-red-800",
    count: "text-red-700",
  },
  warning: {
    label: "Action needed",
    card: "border-amber-200 bg-amber-50/60",
    pill: "bg-amber-100 text-amber-900",
    count: "text-amber-800",
  },
  info: {
    label: "For your information",
    card: "border-[#2436BB]/20 bg-[#2436BB]/5",
    pill: "bg-[#2436BB]/10 text-[#2436BB]",
    count: "text-[#2436BB]",
  },
};

const NEUTRAL_CARD = "border-zinc-200 bg-white";

function AttentionCard({ item }: { item: AttentionItem }) {
  const active = isAttentionActive(item);
  const style = SEVERITY[item.severity];
  const unavailable = !item.count.ok;

  return (
    <li className={`flex flex-col rounded-lg border p-4 ${active ? style.card : NEUTRAL_CARD}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">{item.label}</h3>
        {active ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.pill}`}
          >
            {style.label}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {unavailable ? "Unavailable" : "All clear"}
          </span>
        )}
      </div>
      <p
        className={`mt-2 font-semibold ${
          unavailable ? "text-base text-zinc-400" : `text-2xl ${active ? style.count : "text-zinc-900"}`
        }`}
      >
        {item.count.ok ? item.count.value.toLocaleString("en-CA") : "Couldn’t load"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-600">{item.description}</p>
      {active ? (
        <Link
          href={item.href}
          className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-[#2436BB] underline decoration-[#2436BB]/40 underline-offset-2 hover:decoration-[#2436BB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
        >
          {item.cta} →
        </Link>
      ) : null}
    </li>
  );
}

/** SECTION B — "What needs my attention?" Read-only; nothing here mutates accounts or payments. */
export function AttentionSection({ items }: { items: AttentionItem[] }) {
  const anyActive = items.some(isAttentionActive);
  const anyUnavailable = items.some((i) => !i.count.ok);

  return (
    <section aria-labelledby="needs-attention-heading" className="space-y-3">
      <div>
        <h2 id="needs-attention-heading" className="text-lg font-semibold text-zinc-900">
          Needs Your Attention
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          {anyActive
            ? "Items that need an administrative decision or follow-up."
            : anyUnavailable
              ? "Some checks could not be loaded; the rest are clear."
              : "Nothing needs your attention right now."}
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <AttentionCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
