import { isScopeFit, SCOPE_FIT_BADGE_LABEL } from "@/lib/quote-requests/scope-assessment";

const BADGE_CLASS: Record<string, string> = {
  within_scope: "border-emerald-200 bg-emerald-50 text-emerald-900",
  mixed_scope: "border-amber-200 bg-amber-50 text-amber-900",
  possibly_out_of_scope: "border-orange-200 bg-orange-50 text-orange-900",
  outside_scope: "border-red-200 bg-red-50 text-red-900",
};

export function QuoteRequestScopeNote({
  scopeFit,
  scopeReason,
  contractorNote,
  customerProblemLabel,
  customerProblemConfidence,
}: {
  scopeFit: string | null;
  scopeReason: string | null;
  contractorNote: string | null;
  customerProblemLabel?: string | null;
  customerProblemConfidence?: string | null;
}) {
  if (!scopeFit || !isScopeFit(scopeFit)) {
    return null;
  }

  const badgeLabel = SCOPE_FIT_BADGE_LABEL[scopeFit];
  const badgeClass = BADGE_CLASS[scopeFit] ?? BADGE_CLASS.possibly_out_of_scope;
  const note = contractorNote?.trim() || scopeReason?.trim();
  const problemLabel = customerProblemLabel?.trim();

  if (!note && !problemLabel) {
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
      </div>
      {problemLabel ? (
        <p className="mt-3 text-sm text-zinc-800">
          <span className="font-medium text-zinc-900">Detected customer problem: </span>
          {problemLabel}
          {customerProblemConfidence ? (
            <span className="text-zinc-500"> ({customerProblemConfidence} confidence)</span>
          ) : null}
        </p>
      ) : null}
      {note ? <p className="mt-3 text-sm text-zinc-700">{note}</p> : null}
    </section>
  );
}
