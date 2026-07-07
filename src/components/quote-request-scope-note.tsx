"use client";

import { useState } from "react";
import {
  isScopeFit,
  SCOPE_FIT_BADGE_LABEL,
  type ScopeFit,
} from "@/lib/quote-requests/scope-assessment";
import { storedWorkComponentsToSummary } from "@/lib/quote-requests/work-components/scope-engine";
import type { StoredWorkComponent } from "@/lib/quote-requests/work-components/types";

const BADGE_CLASS: Record<string, string> = {
  within_scope: "border-emerald-200 bg-emerald-50 text-emerald-900",
  mixed_scope: "border-amber-200 bg-amber-50 text-amber-900",
  possibly_out_of_scope: "border-orange-200 bg-orange-50 text-orange-900",
  outside_scope: "border-red-200 bg-red-50 text-red-900",
};

function parseWorkComponents(
  raw: QuoteRequestScopeNoteProps["workComponents"]
): StoredWorkComponent[] | null {
  if (!raw?.length) return null;
  return raw.map((c) => ({
    key: c.key as StoredWorkComponent["key"],
    label: c.label,
    capability: c.capability as StoredWorkComponent["capability"],
    typicalSpecialist: c.typicalSpecialist,
  }));
}

type QuoteRequestScopeNoteProps = {
  scopeFit: string | null;
  scopeReason: string | null;
  contractorNote: string | null;
  customerProblemLabel?: string | null;
  customerProblemConfidence?: string | null;
  scopeConfidence?: string | null;
  workComponents?: Array<{
    key: string;
    label: string;
    capability: string;
    typicalSpecialist?: string;
  }> | null;
  specialistTrades?: string[] | null;
  embedded?: boolean;
};

function formatConfidence(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function parseStructuredNote(note: string): {
  detectedProject: string | null;
  workInvolved: string | null;
  matchReason: string | null;
  confidence: string | null;
} {
  const detected = note.match(/Detected project:\s*(.+)/i)?.[1]?.trim() ?? null;
  const work = note.match(/Work likely involved:\s*(.+)/i)?.[1]?.trim() ?? null;
  const why = note.match(/Why this may or may not match:\s*(.+)/i)?.[1]?.trim() ?? null;
  const confidence = note.match(/Confidence:\s*(.+)/i)?.[1]?.trim() ?? null;
  return {
    detectedProject: detected,
    workInvolved: work,
    matchReason: why,
    confidence,
  };
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  if (match?.[1] && match[1].length <= 240) return match[1].trim();
  if (trimmed.length <= 240) return trimmed;
  return `${trimmed.slice(0, 237).trim()}…`;
}

function scopeConciseSummary(
  scopeFit: ScopeFit,
  scopeReason: string | null,
  matchReason: string | null,
  note: string | null
): string {
  if (matchReason) return firstSentence(matchReason);
  if (scopeReason?.trim()) return firstSentence(scopeReason);
  if (note?.trim()) return firstSentence(note);
  switch (scopeFit) {
    case "within_scope":
      return "This request appears to match your typical scope of work.";
    case "mixed_scope":
      return "Some parts of this project may match your services; review details before committing.";
    case "possibly_out_of_scope":
      return "This project may fall outside your usual scope — review before responding.";
    case "outside_scope":
      return "This project likely falls outside your usual scope of work.";
  }
}

export function QuoteRequestScopeNote({
  scopeFit,
  scopeReason,
  contractorNote,
  customerProblemLabel,
  customerProblemConfidence,
  scopeConfidence,
  workComponents,
  specialistTrades,
  embedded = false,
}: QuoteRequestScopeNoteProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!scopeFit || !isScopeFit(scopeFit)) {
    return null;
  }

  const badgeLabel = SCOPE_FIT_BADGE_LABEL[scopeFit as ScopeFit];
  const badgeClass = BADGE_CLASS[scopeFit] ?? BADGE_CLASS.possibly_out_of_scope;
  const note = contractorNote?.trim() || scopeReason?.trim();
  const parsed = note ? parseStructuredNote(note) : null;

  const detectedProject =
    parsed?.detectedProject || customerProblemLabel?.trim() || null;
  const workInvolved =
    parsed?.workInvolved ||
    storedWorkComponentsToSummary(parseWorkComponents(workComponents)) ||
    null;
  const matchReason = parsed?.matchReason || null;
  const confidence =
    formatConfidence(parsed?.confidence || scopeConfidence || customerProblemConfidence) ||
    null;

  if (!detectedProject && !workInvolved && !matchReason && !note) {
    return null;
  }

  const summary = scopeConciseSummary(scopeFit, scopeReason, matchReason, note ?? null);

  const content = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {!embedded ? (
          <h2 className="text-base font-semibold text-zinc-900">Scope Assessment</h2>
        ) : null}
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
        >
          {badgeLabel}
        </span>
        {confidence && !embedded ? (
          <span className="text-xs text-zinc-500">{confidence} confidence</span>
        ) : null}
      </div>

      <p className="mt-2 text-sm text-zinc-700">{summary}</p>

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="mt-2 text-xs font-medium text-[#2436BB] hover:underline"
        aria-expanded={detailsOpen}
      >
        {detailsOpen ? "Hide details" : "View details"}
      </button>

      {detailsOpen ? (
        <dl className="mt-3 space-y-3 border-t border-zinc-100 pt-3 text-sm">
          {detectedProject ? (
            <div>
              <dt className="font-medium text-zinc-900">Detected project</dt>
              <dd className="mt-0.5 text-zinc-700">{detectedProject}</dd>
            </div>
          ) : null}
          {workInvolved ? (
            <div>
              <dt className="font-medium text-zinc-900">Work likely involved</dt>
              <dd className="mt-0.5 text-zinc-700">{workInvolved}</dd>
            </div>
          ) : null}
          {matchReason ? (
            <div>
              <dt className="font-medium text-zinc-900">Why this may or may not match</dt>
              <dd className="mt-0.5 text-zinc-700">{matchReason}</dd>
            </div>
          ) : null}
          {!matchReason && note ? (
            <div>
              <dt className="font-medium text-zinc-900">Assessment</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-zinc-700">{note}</dd>
            </div>
          ) : null}
          {specialistTrades && specialistTrades.length > 0 ? (
            <div>
              <dt className="font-medium text-zinc-900">Specialist trades that may be involved</dt>
              <dd className="mt-0.5 text-zinc-700">{specialistTrades.join(", ")}</dd>
            </div>
          ) : null}
          {confidence ? (
            <div>
              <dt className="font-medium text-zinc-900">Confidence</dt>
              <dd className="mt-0.5 text-zinc-700">{confidence}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </>
  );

  if (embedded) return content;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      {content}
    </section>
  );
}
