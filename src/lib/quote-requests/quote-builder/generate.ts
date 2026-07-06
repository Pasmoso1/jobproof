import type { QuoteBuilderContext } from "@/lib/quote-requests/quote-builder/context";
import {
  isQuoteBuilderSectionKey,
  QUOTE_BUILDER_SECTION_LABELS,
  QUOTE_BUILDER_SECTION_ORDER,
  type QuoteBuilderSectionDraft,
} from "@/lib/quote-requests/quote-builder/types";
import { buildFallbackQuoteBuilderDraft } from "@/lib/quote-requests/quote-builder/fallback";

type RawAiSection = {
  sectionKey?: string;
  items?: string[];
  text?: string;
};

type RawAiDraft = {
  sections?: RawAiSection[];
};

const SECTION_KEYS_LIST = [
  "project_summary",
  "scope_of_work",
  "included_work",
  "items_requiring_confirmation",
  "optional_upgrades",
  "exclusions",
  "suggested_timeline",
  "suggested_warranty",
  "assumptions",
  "recommended_next_steps",
].join(", ");

function buildSystemPrompt(): string {
  return `You prepare a professional quote draft for a contractor. The contractor reviews and approves everything before sending.

RULES:
- Use ONLY information provided in the input. NEVER invent measurements, materials, prices, permits, or site conditions.
- If information is missing, add it to items_requiring_confirmation — do not guess.
- Do NOT include dollar amounts or price estimates anywhere.
- Scope of Work is the most important section. Include demolition, preparation, installation, cleanup, disposal, and finishing ONLY when supported by the project information.
- Optional upgrades: suggest only when clearly relevant. Never force suggestions.
- Exclusions: include reasonable standard exclusions when appropriate.
- Suggested timeline: provide text only if sufficient information exists; otherwise use exactly: "Timeline to be confirmed after site visit."
- Warranty: suggest appropriate wording for the contractor's trade. Editable professional language.
- Perform an internal quality review: no contradictions, no duplicate work, professional wording, logical order. Do not expose reasoning.

Return JSON only:
{
  "sections": [
    { "sectionKey": "project_summary", "items": ["..."] },
    { "sectionKey": "scope_of_work", "items": ["..."] },
    { "sectionKey": "included_work", "items": ["..."] },
    { "sectionKey": "items_requiring_confirmation", "items": ["..."] },
    { "sectionKey": "optional_upgrades", "items": ["..."] },
    { "sectionKey": "exclusions", "items": ["..."] },
    { "sectionKey": "suggested_timeline", "text": "..." },
    { "sectionKey": "suggested_warranty", "items": ["..."] },
    { "sectionKey": "assumptions", "items": ["..."] },
    { "sectionKey": "recommended_next_steps", "items": ["..."] }
  ]
}

Valid sectionKey values: ${SECTION_KEYS_LIST}
Each items array should contain clear bullet strings. Omit empty optional_upgrades if nothing relevant.`;
}

function buildUserPrompt(context: QuoteBuilderContext): string {
  const parts: string[] = [
    `Customer: ${context.customerName}`,
    `Project type: ${context.projectType}`,
    `Property: ${context.propertyAddress}`,
    `Urgent: ${context.isUrgent ? "Yes" : "No"}`,
    `Customer description:\n${context.description}`,
  ];

  if (context.followUpAnswers.length) {
    parts.push(
      "Follow-up interview:\n" +
        context.followUpAnswers
          .map((a) => `Q: ${a.question}\nA: ${a.answer ?? "—"}`)
          .join("\n\n")
    );
  }

  if (context.projectBrief) {
    parts.push(
      "Project brief overview:\n" +
        context.projectBrief.overview.map((s) => `- ${s.text}`).join("\n")
    );
    if (context.projectBrief.keyFacts.length) {
      parts.push(
        "Key facts:\n" + context.projectBrief.keyFacts.map((s) => `- ${s.text}`).join("\n")
      );
    }
    if (context.projectBrief.itemsToVerify.length) {
      parts.push(
        "Items to verify:\n" +
          context.projectBrief.itemsToVerify.map((s) => `- ${s.text}`).join("\n")
      );
    }
  }

  if (context.scopeFit) {
    parts.push(`Scope assessment: ${context.scopeFit} — ${context.scopeReason ?? ""}`);
  }

  if (context.workComponents?.length) {
    parts.push(
      "Work components:\n" +
        context.workComponents.map((w) => `- ${w.label} (${w.capability})`).join("\n")
    );
  }

  const trades = [
    context.primaryTrade ? `Primary trade: ${context.primaryTrade}` : null,
    context.additionalTrades.length
      ? `Additional trades: ${context.additionalTrades.join(", ")}`
      : null,
    context.extraCapabilities ? `Extra capabilities: ${context.extraCapabilities}` : null,
  ].filter(Boolean);
  if (trades.length) parts.push(trades.join("\n"));

  if (context.siteVisit) {
    if (context.siteVisit.quickNotes.trim()) {
      parts.push(`Site visit quick notes:\n${context.siteVisit.quickNotes.trim()}`);
    }
    for (const section of context.siteVisit.organizedSections) {
      parts.push(
        `Site visit — ${section.label}:\n` +
          section.observations.map((o) => `- ${o}`).join("\n")
      );
    }
    if (context.siteVisitHasCustomerChanges) {
      parts.push(
        "IMPORTANT: Site visit notes indicate customer-requested changes from the original request. Update scope accordingly."
      );
    }
  }

  if (context.checklistItems.length) {
    const incomplete = context.checklistItems.filter((i) => !i.completed);
    if (incomplete.length) {
      parts.push(
        "Open checklist items:\n" +
          incomplete.slice(0, 8).map((i) => `- ${i.title}`).join("\n")
      );
    }
  }

  parts.push(`Customer photos provided: ${context.photoCount}`);

  return parts.join("\n\n");
}

function parseAiDraft(raw: RawAiDraft): QuoteBuilderSectionDraft[] | null {
  if (!Array.isArray(raw.sections) || raw.sections.length === 0) return null;

  const drafts: QuoteBuilderSectionDraft[] = [];
  for (const section of raw.sections) {
    const key = String(section.sectionKey ?? "").trim();
    if (!isQuoteBuilderSectionKey(key) || key === "pricing") continue;

    if (key === "suggested_timeline") {
      const text = String(section.text ?? "").trim() || "Timeline to be confirmed after site visit.";
      drafts.push({
        sectionKey: key,
        title: QUOTE_BUILDER_SECTION_LABELS[key],
        content: { version: 1, text },
        displayOrder: QUOTE_BUILDER_SECTION_ORDER[key],
      });
      continue;
    }

    const items = Array.isArray(section.items)
      ? section.items.map((i) => String(i ?? "").trim()).filter(Boolean)
      : [];
    drafts.push({
      sectionKey: key,
      title: QUOTE_BUILDER_SECTION_LABELS[key],
      content: { version: 1, items },
      displayOrder: QUOTE_BUILDER_SECTION_ORDER[key],
    });
  }

  if (!drafts.some((d) => d.sectionKey === "scope_of_work")) return null;
  return drafts;
}

export async function generateQuoteBuilderDraftWithAi(
  context: QuoteBuilderContext
): Promise<QuoteBuilderSectionDraft[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return buildFallbackQuoteBuilderDraft(context);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2500,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(context) },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[generateQuoteBuilderDraftWithAi] OpenAI error", response.status);
      return buildFallbackQuoteBuilderDraft(context);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return buildFallbackQuoteBuilderDraft(context);

    const parsed = parseAiDraft(JSON.parse(content) as RawAiDraft);
    if (!parsed) return buildFallbackQuoteBuilderDraft(context);

    const fallback = buildFallbackQuoteBuilderDraft(context);
    const byKey = new Map(parsed.map((d) => [d.sectionKey, d]));

    return fallback.map((fb) => {
      const ai = byKey.get(fb.sectionKey);
      if (!ai) return fb;
      if (fb.sectionKey === "pricing") return fb;
      if (fb.sectionKey === "suggested_timeline") {
        const aiText = (ai.content as { text?: string }).text?.trim();
        if (!aiText || aiText === "Timeline to be confirmed after site visit.") return fb;
        return ai;
      }
      const aiItems = (ai.content as { items?: string[] }).items ?? [];
      if (aiItems.length === 0) return fb;
      return ai;
    });
  } catch (err) {
    console.error("[generateQuoteBuilderDraftWithAi]", err);
    return buildFallbackQuoteBuilderDraft(context);
  }
}
