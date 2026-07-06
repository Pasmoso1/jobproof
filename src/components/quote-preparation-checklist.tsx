"use client";

import { useMemo, useState, useTransition } from "react";
import { toggleQuoteChecklistItem } from "@/app/(app)/quote-requests/[requestId]/checklist-actions";
import {
  CHECKLIST_CATEGORIES,
  CHECKLIST_CATEGORY_DEFAULT_OPEN,
  CHECKLIST_CATEGORY_LABELS,
  type ChecklistCategory,
  type ChecklistPriority,
  type QuoteChecklistItem,
} from "@/lib/quote-requests/quote-checklist/types";

const PRIORITY_BADGE: Record<
  ChecklistPriority,
  { label: string; className: string }
> = {
  Critical: { label: "🔴 Critical", className: "border-red-200 bg-red-50 text-red-900" },
  Important: {
    label: "🟡 Important",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  Optional: { label: "⚪ Optional", className: "border-zinc-200 bg-zinc-50 text-zinc-700" },
};

function ChecklistItemRow({
  item,
  requestId,
  onToggled,
}: {
  item: QuoteChecklistItem;
  requestId: string;
  onToggled: (item: QuoteChecklistItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleToggle(checked: boolean) {
    startTransition(async () => {
      const result = await toggleQuoteChecklistItem(requestId, item.id, checked);
      if (result.success) {
        onToggled(result.item);
      }
    });
  }

  return (
    <li className={`rounded-lg border border-zinc-100 px-3 py-2.5 ${item.completed ? "bg-zinc-50/80" : "bg-white"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.completed}
          disabled={pending}
          onChange={(e) => handleToggle(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 text-[#2436BB] focus:ring-[#2436BB] disabled:opacity-50"
          aria-label={`Mark complete: ${item.title}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[item.priority].className}`}
            >
              {PRIORITY_BADGE[item.priority].label}
            </span>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={`text-left text-sm font-medium ${item.completed ? "text-zinc-500 line-through" : "text-zinc-900"}`}
            >
              {item.title}
            </button>
          </div>
          {expanded ? (
            <p className="mt-1.5 text-sm text-zinc-600">{item.description}</p>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-0.5 text-xs text-zinc-500 hover:text-zinc-700"
            >
              Show details
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function CollapsibleCategory({
  category,
  items,
  requestId,
  onItemToggled,
}: {
  category: ChecklistCategory;
  items: QuoteChecklistItem[];
  requestId: string;
  onItemToggled: (item: QuoteChecklistItem) => void;
}) {
  const defaultOpen = CHECKLIST_CATEGORY_DEFAULT_OPEN[category] ?? false;
  const [open, setOpen] = useState(defaultOpen);

  if (items.length === 0 && category !== "potential_risks") {
    return null;
  }

  const showNoRisks =
    category === "potential_risks" && items.length === 0;

  return (
    <div className="border-t border-zinc-100 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-zinc-900">
          {CHECKLIST_CATEGORY_LABELS[category]}
        </span>
        <span className="text-xs text-zinc-500">
          {items.length > 0 ? `${items.length} item${items.length === 1 ? "" : "s"}` : null}
          {open ? " · Hide" : " · Show"}
        </span>
      </button>
      {open ? (
        <div className="pb-4">
          {showNoRisks ? (
            <p className="text-sm text-zinc-600">No significant risks identified.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  requestId={requestId}
                  onToggled={onItemToggled}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function QuotePreparationChecklist({
  requestId,
  items: initialItems,
  generatedAt,
}: {
  requestId: string;
  items: QuoteChecklistItem[];
  generatedAt: string | null;
}) {
  const [items, setItems] = useState(initialItems);

  const itemsByCategory = useMemo(() => {
    const map = new Map<ChecklistCategory, QuoteChecklistItem[]>();
    for (const cat of CHECKLIST_CATEGORIES) {
      map.set(cat, []);
    }
    for (const item of items) {
      const list = map.get(item.category);
      if (list) list.push(item);
    }
    return map;
  }, [items]);

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function handleItemToggled(updated: QuoteChecklistItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Quote Preparation Checklist</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Private workflow — actions to prepare your quote, site visit, and first call.
          </p>
        </div>
        <div className="text-right text-xs text-zinc-600">
          <p className="font-medium text-zinc-900">
            {completedCount} of {totalCount} complete ({progress}%)
          </p>
          {generatedAt ? (
            <p className="mt-0.5 text-zinc-500">Updated {new Date(generatedAt).toLocaleString()}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-[#2436BB] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-2">
        {CHECKLIST_CATEGORIES.map((category) => (
          <CollapsibleCategory
            key={category}
            category={category}
            items={itemsByCategory.get(category) ?? []}
            requestId={requestId}
            onItemToggled={handleItemToggled}
          />
        ))}
      </div>
    </section>
  );
}
