import {
  isChecklistCategory,
  isChecklistGeneratedFrom,
  isChecklistPriority,
  type ChecklistItemDraft,
  type QuoteChecklistContext,
} from "@/lib/quote-requests/quote-checklist/types";
import { computeChecklistStableKey } from "@/lib/quote-requests/quote-checklist/stable-key";

type RawAiItem = {
  category?: string;
  title?: string;
  description?: string;
  priority?: string;
  generatedFrom?: string;
  aiReason?: string;
  stableKey?: string;
};

type RawAiChecklist = {
  items?: RawAiItem[];
  noSignificantRisks?: boolean;
};

function parseAiItem(raw: RawAiItem, displayOrder: number): ChecklistItemDraft | null {
  const category = String(raw.category ?? "").trim();
  const title = String(raw.title ?? "").trim();
  const description = String(raw.description ?? "").trim();
  const priority = String(raw.priority ?? "").trim();
  const generatedFrom = String(raw.generatedFrom ?? "customer_request").trim();
  const aiReason = String(raw.aiReason ?? "").trim();

  if (!isChecklistCategory(category) || !title || !description) return null;
  if (!isChecklistPriority(priority)) return null;
  if (!isChecklistGeneratedFrom(generatedFrom)) return null;

  const stableKey =
    String(raw.stableKey ?? "").trim() ||
    computeChecklistStableKey(category, title);

  return {
    stableKey,
    category,
    title,
    description,
    priority,
    generatedFrom,
    aiReason: aiReason || "AI generated",
    displayOrder,
  };
}

function buildSystemPrompt(): string {
  return `You generate a Quote Preparation Checklist for a contractor preparing to quote a job.

CORE RULE: Every item must be an ACTION the contractor should take — not an observation or summary.
Think like an experienced estimator. Answer: "What should the contractor do next?"

Do NOT duplicate the Project Brief. Do NOT restate customer facts without a clear action.
Do NOT estimate prices.

CATEGORIES (only include relevant ones):
- before_contacting_customer: review items, questions to prepare, confirmed info to use, customer priorities
- during_first_conversation: questions worth asking, clarifications, pricing decisions — do NOT repeat confirmed info
- site_visit: inspection, measurements, access, utilities, drainage, conditions, materials, equipment, safety, permits — only relevant items
- pricing_considerations: actions for unknown measurements, materials, demolition, disposal, permits, labour uncertainty, site conditions
- potential_risks: only genuine risks as actionable items; if none, set noSignificantRisks true and omit risk items
- recommended_next_action: exactly ONE item with one clear recommendation

PRIORITY: Critical | Important | Optional

generatedFrom must be one of: description, photos, follow_up_answers, scope_assessment, project_brief, work_components, customer_request, contractor_trades, urgency

Return JSON only:
{
  "noSignificantRisks": false,
  "items": [
    {
      "category": "before_contacting_customer",
      "title": "Short action title",
      "description": "One sentence explaining what to do.",
      "priority": "Critical",
      "generatedFrom": "customer_request",
      "aiReason": "internal only",
      "stableKey": "optional deterministic key"
    }
  ]
}`;
}

function buildUserPrompt(context: QuoteChecklistContext): string {
  const scopeSection = context.scopeFit
    ? `Scope fit: ${context.scopeFit}\nScope reason: ${context.scopeReason ?? "—"}`
    : "Scope: not yet assessed";

  const trades = [
    context.primaryTrade ? `Primary: ${context.primaryTrade}` : null,
    context.additionalTrades.length
      ? `Additional: ${context.additionalTrades.join(", ")}`
      : null,
    context.extraCapabilities ? `Extra: ${context.extraCapabilities}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const workComponents = context.workComponents?.length
    ? context.workComponents
        .map((c: { label: string; capability: string }) => `- ${c.label} (${c.capability})`)
        .join("\n")
    : "None";

  const interview = context.previousAnswers.length
    ? context.previousAnswers
        .map((a: { question: string; answer: string | null }) => `Q: ${a.question}\nA: ${a.answer ?? "(skipped)"}`)
        .join("\n\n")
    : "None";

  const brief = context.projectBrief
    ? JSON.stringify(context.projectBrief, null, 2)
    : "Not yet generated";

  return [
    `Customer: ${context.customerName}`,
    `Project type: ${context.projectType}`,
    `Urgent: ${context.isUrgent ? "yes" : "no"}`,
    `Photos: ${context.photoCount}`,
    `Interview completed: ${context.interviewCompleted ? "yes" : "no"}`,
    "",
    "DESCRIPTION:",
    context.description,
    "",
    scopeSection,
    context.contractorNote ? `Contractor scope note:\n${context.contractorNote}` : "",
    context.customerProblemLabel ? `Detected problem: ${context.customerProblemLabel}` : "",
    "",
    "WORK COMPONENTS:",
    workComponents,
    context.specialistTrades?.length
      ? `Specialist trades: ${context.specialistTrades.join(", ")}`
      : "",
    "",
    "CONTRACTOR TRADES:",
    trades || "Not specified",
    "",
    "FOLLOW-UP ANSWERS:",
    interview,
    "",
    "PROJECT BRIEF (do not duplicate — use only to inform actions):",
    brief,
    "",
    `Trigger: ${context.trigger}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateChecklistWithAi(
  context: QuoteChecklistContext
): Promise<ChecklistItemDraft[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

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
        temperature: 0.25,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(context) },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[quote-checklist] OpenAI error", response.status);
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = JSON.parse(content) as RawAiChecklist;
    const items: ChecklistItemDraft[] = [];
    let order = 1;

    for (const raw of parsed.items ?? []) {
      const item = parseAiItem(raw, order);
      if (!item) continue;
      items.push({ ...item, displayOrder: order });
      order += 1;
    }

    const hasRisk = items.some((i) => i.category === "potential_risks");
    if (!hasRisk && parsed.noSignificantRisks) {
      // No risk items — UI shows category message
    }

    const nextActions = items.filter((i) => i.category === "recommended_next_action");
    if (nextActions.length > 1) {
      const keep = nextActions[0];
      return items.filter(
        (i) => i.category !== "recommended_next_action" || i.stableKey === keep.stableKey
      );
    }

    return items.length > 0 ? items : null;
  } catch (error) {
    console.error("[quote-checklist] generation failed", error);
    return null;
  }
}
