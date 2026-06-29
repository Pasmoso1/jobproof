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

export function QuoteRequestScopeNote({
  scopeFit,
  scopeReason,
  contractorNote,
  customerProblemLabel,
  customerProblemConfidence,
  scopeConfidence,
  workComponents,
  specialistTrades,
}: QuoteRequestScopeNoteProps) {
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

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-zinc-900">Scope note</h2>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
        >
          {badgeLabel}
        </span>
        {confidence ? (
          <span className="text-xs text-zinc-500">{confidence} confidence</span>
        ) : null}
      </div>

      <dl className="mt-4 space-y-3 text-sm">
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
      </dl>
    </section>
  );
}
