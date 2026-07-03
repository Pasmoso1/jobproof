"use client";

import { useState } from "react";
import type {
  ProjectBrief,
  ProjectBriefConfidence,
  ProjectBriefStatement,
} from "@/lib/quote-requests/project-brief/types";

const CONFIDENCE_DOT: Record<ProjectBriefConfidence, string> = {
  confirmed: "bg-emerald-500",
  likely: "bg-amber-400",
  needs_verification: "bg-zinc-300",
};

const CONFIDENCE_LABEL: Record<ProjectBriefConfidence, string> = {
  confirmed: "Confirmed",
  likely: "Likely",
  needs_verification: "Verify",
};

function BriefStatement({ item }: { item: ProjectBriefStatement }) {
  return (
    <span className="inline-flex items-start gap-2">
      <span
        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${CONFIDENCE_DOT[item.confidence]}`}
        title={CONFIDENCE_LABEL[item.confidence]}
        aria-hidden
      />
      <span className="text-sm text-zinc-800">{item.text}</span>
    </span>
  );
}

function BriefStatementList({ items }: { items: ProjectBriefStatement[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">None listed.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item.text.slice(0, 40)}-${index}`}>
          <BriefStatement item={item} />
        </li>
      ))}
    </ul>
  );
}

function CollapsibleSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
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
        <span className="text-sm font-semibold text-zinc-900">{title}</span>
        <span className="text-xs text-zinc-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div className="pb-4">{children}</div> : null}
    </div>
  );
}

function SnapshotGrid({ brief }: { brief: ProjectBrief }) {
  const rows: Array<{ label: string; item: ProjectBriefStatement | null }> = [
    { label: "Service requested", item: brief.snapshot.serviceRequested },
    { label: "Urgency", item: brief.snapshot.urgency },
    { label: "Project stage", item: brief.snapshot.projectStage },
    { label: "Preferred completion", item: brief.snapshot.preferredCompletionDate },
    { label: "Photos received", item: brief.snapshot.photosReceived },
    { label: "Interview completed", item: brief.snapshot.interviewCompleted },
    { label: "Likely scope fit", item: brief.snapshot.likelyScopeFit },
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(({ label, item }) =>
        item ? (
          <div key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
            <dd className="mt-1">
              <BriefStatement item={item} />
            </dd>
          </div>
        ) : null
      )}
    </dl>
  );
}

export function QuoteRequestProjectBrief({ brief }: { brief: ProjectBrief | null }) {
  if (!brief) return null;

  const hasRisks = brief.potentialRisks.length > 0;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">Project Brief</h2>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            Confirmed
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
            Likely
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" aria-hidden />
            Verify
          </span>
        </div>
      </div>

      <div className="mt-2">
        <CollapsibleSection title="Overview" defaultOpen>
          <div className="space-y-2">
            {brief.overview.map((item, index) => (
              <p key={`overview-${index}`}>
                <BriefStatement item={item} />
              </p>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Project Snapshot" defaultOpen={false}>
          <SnapshotGrid brief={brief} />
        </CollapsibleSection>

        <CollapsibleSection title="Key Facts" defaultOpen={false}>
          <BriefStatementList items={brief.keyFacts} />
        </CollapsibleSection>

        <CollapsibleSection title="Items to Verify" defaultOpen={false}>
          <BriefStatementList items={brief.itemsToVerify} />
        </CollapsibleSection>

        <CollapsibleSection title="Potential Risks" defaultOpen={false}>
          {hasRisks ? (
            <BriefStatementList items={brief.potentialRisks} />
          ) : (
            <p className="text-sm text-zinc-600">
              {brief.risksNoneMessage ?? "No obvious concerns identified."}
            </p>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Recommended Next Step" defaultOpen>
          <div className="rounded-lg border border-[#2436BB]/15 bg-[#2436BB]/5 px-4 py-3">
            <BriefStatement item={brief.recommendedNextStep} />
          </div>
        </CollapsibleSection>
      </div>
    </section>
  );
}
