"use client";

import { useState } from "react";
import { QuotePreparationChecklist } from "@/components/quote-preparation-checklist";
import { QuoteRequestProjectBrief } from "@/components/quote-request-project-brief";
import { QuoteRequestScopeNote } from "@/components/quote-request-scope-note";
import type { ProjectBrief } from "@/lib/quote-requests/project-brief/types";
import type { QuoteChecklistItem } from "@/lib/quote-requests/quote-checklist/types";
import type { QuoteRequestStatusType } from "@/types/database";

function AssistantSubsection({
  title,
  defaultOpen,
  badge,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-zinc-100 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          {title}
          {badge ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="text-xs text-zinc-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div className="pb-4">{children}</div> : null}
    </div>
  );
}

export function QuoteRequestProjectAssistant({
  projectBrief,
  scopeFit,
  scopeReason,
  contractorNote,
  customerProblemLabel,
  customerProblemConfidence,
  scopeConfidence,
  workComponents,
  specialistTrades,
  requestId,
  checklistItems,
  checklistGeneratedAt,
  status,
}: {
  projectBrief: ProjectBrief | null;
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
  requestId: string;
  checklistItems: QuoteChecklistItem[];
  checklistGeneratedAt: string | null;
  status: QuoteRequestStatusType;
}) {
  const [open, setOpen] = useState(false);

  const hasBrief = Boolean(projectBrief);
  const hasScope = Boolean(scopeFit);
  const hasChecklist = checklistItems.length > 0;
  const hasContent = hasBrief || hasScope || hasChecklist;

  if (!hasContent) return null;

  const checklistDefaultOpen = status === "reviewed" || status === "responded";
  const checklistBadge =
    checklistItems.length > 0
      ? `${checklistItems.filter((i) => i.completed).length}/${checklistItems.length}`
      : undefined;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Project Assistant</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Project brief, scope assessment, and preparation checklist
          </p>
        </div>
        <span className="shrink-0 text-xs text-zinc-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="mt-2">
          {hasBrief ? (
            <AssistantSubsection title="Project Brief" defaultOpen={false}>
              <QuoteRequestProjectBrief brief={projectBrief} embedded />
            </AssistantSubsection>
          ) : null}

          {hasScope ? (
            <AssistantSubsection title="Scope Assessment" defaultOpen={false}>
              <QuoteRequestScopeNote
                scopeFit={scopeFit}
                scopeReason={scopeReason}
                contractorNote={contractorNote}
                customerProblemLabel={customerProblemLabel}
                customerProblemConfidence={customerProblemConfidence}
                scopeConfidence={scopeConfidence}
                workComponents={workComponents}
                specialistTrades={specialistTrades}
                embedded
              />
            </AssistantSubsection>
          ) : null}

          {hasChecklist ? (
            <AssistantSubsection
              title="Quote Preparation Checklist"
              defaultOpen={checklistDefaultOpen}
              badge={checklistBadge}
            >
              <QuotePreparationChecklist
                requestId={requestId}
                items={checklistItems}
                generatedAt={checklistGeneratedAt}
                embedded
              />
            </AssistantSubsection>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
