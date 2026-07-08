"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  generateQuoteBuilderDraftAction,
  saveQuoteBuilderDraft,
  saveQuoteBuilderSection,
  sendQuoteFromBuilder,
} from "@/app/(app)/quote-requests/[requestId]/builder-actions";
import {
  listItemsToText,
  textToListItems,
  type QuoteBuilderDraft,
  type QuoteBuilderListContent,
  type QuoteBuilderPricingContent,
  type QuoteBuilderSection,
  type QuoteBuilderSectionContent,
  type QuoteBuilderTimelineContent,
} from "@/lib/quote-requests/quote-builder/types";

function CollapsibleSection({
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
    <div className="rounded-lg border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
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
      {open ? <div className="border-t border-zinc-100 px-4 pb-4 pt-3">{children}</div> : null}
    </div>
  );
}

function ListSectionEditor({
  section,
  onChange,
  onSaveState,
  disabled,
}: {
  section: QuoteBuilderSection;
  onChange: (content: QuoteBuilderListContent) => void;
  onSaveState: (state: "saving" | "saved" | "error") => void;
  disabled?: boolean;
}) {
  const content = section.content as QuoteBuilderListContent;
  const [text, setText] = useState(() => listItemsToText(content.items));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(value: string) {
    if (disabled) return;
    setText(value);
    const items = textToListItems(value);
    onChange({ version: 1, items });
    onSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSaveState("saved"), 800);
  }

  return (
    <textarea
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      disabled={disabled}
      rows={Math.max(4, Math.min(12, text.split("\n").length + 1))}
      placeholder="One item per line"
      className="w-full resize-y rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
    />
  );
}

function TimelineSectionEditor({
  section,
  onChange,
  onSaveState,
  disabled,
}: {
  section: QuoteBuilderSection;
  onChange: (content: QuoteBuilderTimelineContent) => void;
  onSaveState: (state: "saving" | "saved" | "error") => void;
  disabled?: boolean;
}) {
  const content = section.content as QuoteBuilderTimelineContent;
  const [text, setText] = useState(() => content.text);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(value: string) {
    if (disabled) return;
    setText(value);
    onChange({ version: 1, text: value });
    onSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSaveState("saved"), 800);
  }

  return (
    <textarea
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      disabled={disabled}
      rows={3}
      placeholder="Describe the expected timeline"
      className="w-full resize-y rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
    />
  );
}

const PRICING_FIELDS: Array<{ key: keyof QuoteBuilderPricingContent; label: string }> = [
  { key: "labour", label: "Labour" },
  { key: "materials", label: "Materials" },
  { key: "equipment", label: "Equipment" },
  { key: "permits", label: "Permits" },
  { key: "other", label: "Other" },
  { key: "subtotal", label: "Subtotal" },
  { key: "tax", label: "Tax" },
  { key: "total", label: "Total" },
];

function PricingSectionEditor({
  section,
  onChange,
  onSaveState,
  disabled,
}: {
  section: QuoteBuilderSection;
  onChange: (content: QuoteBuilderPricingContent) => void;
  onSaveState: (state: "saving" | "saved" | "error") => void;
  disabled?: boolean;
}) {
  const content = section.content as QuoteBuilderPricingContent;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateField(key: keyof QuoteBuilderPricingContent, value: string) {
    if (disabled) return;
    const next = { ...content, [key]: value };
    onChange(next);
    onSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSaveState("saved"), 800);
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {PRICING_FIELDS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2">
          <dt className="w-24 shrink-0 text-sm text-zinc-600">{label}</dt>
          <dd className="flex min-w-0 flex-1 items-center gap-1">
            <span className="text-sm text-zinc-500">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={content[key]}
              onChange={(e) => updateField(key, e.target.value)}
              disabled={disabled}
              placeholder="0.00"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SectionEditor({
  section,
  requestId,
  onUpdated,
  readOnly,
}: {
  section: QuoteBuilderSection;
  requestId: string;
  onUpdated: (section: QuoteBuilderSection) => void;
  readOnly: boolean;
}) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentRef = useRef<QuoteBuilderSectionContent | null>(null);

  const persist = useCallback(
    (content: QuoteBuilderSectionContent) => {
      if (readOnly) return;
      pendingContentRef.current = content;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const toSave = pendingContentRef.current;
        if (!toSave) return;
        setSaveState("saving");
        startTransition(async () => {
          const result = await saveQuoteBuilderSection(requestId, section.sectionKey, toSave);
          if (result.success) {
            onUpdated(result.section);
            setSaveState("saved");
          } else {
            setSaveState("error");
          }
        });
      }, 1200);
    },
    [requestId, section.sectionKey, onUpdated, readOnly]
  );

  const defaultOpen =
    section.sectionKey === "project_summary" || section.sectionKey === "scope_of_work";

  return (
    <CollapsibleSection
      title={section.title}
      defaultOpen={defaultOpen}
      badge={section.contractorEdited ? "Edited" : undefined}
    >
      {section.sectionKey === "pricing" ? (
        <PricingSectionEditor
          key={`${section.id}-${section.updatedAt}`}
          section={section}
          onChange={persist}
          onSaveState={(s) => setSaveState(s === "saved" ? "saved" : "saving")}
          disabled={readOnly}
        />
      ) : section.sectionKey === "suggested_timeline" ? (
        <TimelineSectionEditor
          key={`${section.id}-${section.updatedAt}`}
          section={section}
          onChange={persist}
          onSaveState={(s) => setSaveState(s === "saved" ? "saved" : "saving")}
          disabled={readOnly}
        />
      ) : (
        <ListSectionEditor
          key={`${section.id}-${section.updatedAt}`}
          section={section}
          onChange={persist}
          onSaveState={(s) => setSaveState(s === "saved" ? "saved" : "saving")}
          disabled={readOnly}
        />
      )}
      {!readOnly ? (
        <p className="mt-2 text-xs text-zinc-500">
          {saveState === "saving" || pending
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : saveState === "error"
                ? "Save failed"
                : "Auto-saves as you edit"}
        </p>
      ) : null}
    </CollapsibleSection>
  );
}

export function QuoteRequestBuilder({
  requestId,
  initialDraft,
  customerId,
  estimateId,
}: {
  requestId: string;
  initialDraft: QuoteBuilderDraft;
  customerId?: string | null;
  estimateId?: string | null;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasSections = draft.sections.length > 0;
  const isSent = draft.status === "sent";
  const createButtonLabel =
    draft.generatedAt || draft.status !== "empty" ? "Update Quote" : "Create Quote";

  const sortedSections = useMemo(
    () => [...draft.sections].sort((a, b) => a.displayOrder - b.displayOrder),
    [draft.sections]
  );

  function handleGenerate(regenerate: boolean) {
    setError(null);
    setMessage(null);
    setWarning(null);
    startTransition(async () => {
      const result = await generateQuoteBuilderDraftAction(requestId, regenerate);
      if (result.success) {
        setDraft(result.draft);
        setMessage(regenerate ? "Suggestions regenerated." : "Quote created.");
      } else {
        setError(result.error);
      }
    });
  }

  function handleSaveDraft() {
    setError(null);
    startTransition(async () => {
      const result = await saveQuoteBuilderDraft(requestId);
      if (result.success) {
        setDraft((d) => ({ ...d, status: d.status === "sent" ? "sent" : "draft" }));
        setMessage("Draft saved.");
      } else {
        setError(result.error);
      }
    });
  }

  function handleSendQuote() {
    setError(null);
    setMessage(null);
    setWarning(null);
    if (!customerId) {
      setError("Add the customer before sending the quote.");
      return;
    }
    startTransition(async () => {
      const result = await sendQuoteFromBuilder(requestId);
      if (!result.success) {
        setError(result.error);
        return;
      }

      const sentParts: string[] = [];
      const warningParts: string[] = [];

      if (result.emailSent) sentParts.push("email");
      else if (result.emailWarning) warningParts.push(result.emailWarning);

      if (result.smsSent) sentParts.push("text");
      else if (result.smsWarning) warningParts.push(result.smsWarning);

      if (result.emailSent) {
        setDraft((d) => ({ ...d, status: "sent" }));
        if (sentParts.length > 0) {
          setMessage(`Quote sent. Customer notified by ${sentParts.join(" and ")}.`);
        } else {
          setMessage("Quote sent.");
        }
      } else {
        setMessage("Estimate prepared. Email could not be sent — try again from Estimates.");
      }

      if (warningParts.length > 0) {
        setWarning(warningParts.join(" "));
      }
    });
  }

  function handleSectionUpdated(section: QuoteBuilderSection) {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === section.id ? section : s)),
      status: d.status === "sent" ? "sent" : "draft",
    }));
  }

  return (
    <section className="relative">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 pb-24">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Quote Builder</h2>
            <p className="mt-0.5 text-sm text-zinc-600">
              Review and customize your quote before sending it to your customer.
            </p>
          </div>
          {isSent ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              Sent
            </span>
          ) : hasSections ? (
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
              Draft
            </span>
          ) : null}
        </div>

        {isSent && estimateId ? (
          <p className="mt-3 text-sm text-zinc-600">
            <Link href={`/estimates/${estimateId}`} className="font-medium text-[#2436BB] hover:underline">
              View estimate →
            </Link>
          </p>
        ) : null}

        {!customerId && hasSections && !isSent ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Add the customer in Actions before sending this quote.
          </p>
        ) : null}

        {draft.siteVisitBanner ? (
          <p className="mt-4 rounded-lg border border-[#2436BB]/20 bg-[#2436BB]/5 px-3 py-2.5 text-sm text-[#2436BB]">
            Project updated based on customer changes discussed during the site visit.
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {warning ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {warning}
          </p>
        ) : null}

        {message ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}

        {!hasSections ? (
          <div className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
            <p className="text-sm text-zinc-600">
              Generate a professional first draft from everything JobProof knows about this project.
            </p>
            <button
              type="button"
              onClick={() => handleGenerate(false)}
              disabled={pending}
              className="mt-4 rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e2d9a] disabled:opacity-50"
            >
              {pending ? "Working…" : createButtonLabel}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {sortedSections.map((section) => (
              <SectionEditor
                key={section.id}
                section={section}
                requestId={requestId}
                onUpdated={handleSectionUpdated}
                readOnly={isSent}
              />
            ))}
          </div>
        )}
      </div>

      {hasSections && !isSent ? (
        <div className="sticky bottom-0 z-10 -mx-1 mt-3 rounded-xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/90">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              {draft.generatedAt
                ? `Last generated ${new Date(draft.generatedAt).toLocaleString()}`
                : "Draft in progress"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={pending}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => handleGenerate(true)}
                disabled={pending}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                {pending ? "Working…" : "Regenerate Suggestions"}
              </button>
              <button
                type="button"
                onClick={handleSendQuote}
                disabled={pending}
                className="rounded-lg bg-[#2436BB] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1e2d9a] disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send Quote"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
