"use client";

import { useState } from "react";
import { formatDateTimeEastern } from "@/lib/datetime-eastern";
import type { QuoteRequestEvent } from "@/types/database";

export function QuoteRequestHistory({
  events,
}: {
  events: QuoteRequestEvent[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <h2 className="text-base font-semibold text-zinc-900">History</h2>
        <span className="text-xs text-zinc-500">
          {events.length > 0 ? `${events.length} entries · ` : ""}
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? (
        <div className="mt-4">
          {events.length > 0 ? (
            <ol className="space-y-3">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0"
                >
                  <p className="text-sm font-medium text-zinc-900">{event.event_label}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {formatDateTimeEastern(event.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-zinc-600">No history entries yet.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
