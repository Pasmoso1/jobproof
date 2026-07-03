import {
  isProjectBriefConfidence,
  type ProjectBrief,
  type ProjectBriefStatement,
} from "@/lib/quote-requests/project-brief/types";
import type { ProjectBriefContext } from "@/lib/quote-requests/project-brief/persist";

const MAX_BRIEF_PHOTOS = 4;

type RawAiBrief = {
  overview?: Array<{ text?: string; confidence?: string }>;
  snapshot?: Record<string, { text?: string; confidence?: string } | null>;
  keyFacts?: Array<{ text?: string; confidence?: string }>;
  itemsToVerify?: Array<{ text?: string; confidence?: string }>;
  potentialRisks?: Array<{ text?: string; confidence?: string }>;
  risksNoneMessage?: string | null;
  recommendedNextStep?: { text?: string; confidence?: string };
};

function parseAiStatement(raw: { text?: string; confidence?: string } | null | undefined) {
  const text = String(raw?.text ?? "").trim();
  const confidence = String(raw?.confidence ?? "").trim();
  if (!text || !isProjectBriefConfidence(confidence)) return null;
  return { text, confidence };
}

function parseAiStatementList(raw: unknown): ProjectBriefStatement[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => parseAiStatement(item)).filter((s): s is ProjectBriefStatement => s !== null);
}

function parseAiBrief(raw: RawAiBrief): ProjectBrief | null {
  const overview = parseAiStatementList(raw.overview);
  const recommendedNextStep = parseAiStatement(raw.recommendedNextStep);
  if (!overview.length || !recommendedNextStep) return null;

  const snap = raw.snapshot ?? {};
  const serviceRequested = parseAiStatement(snap.serviceRequested);
  const urgency = parseAiStatement(snap.urgency);
  const projectStage = parseAiStatement(snap.projectStage);
  const photosReceived = parseAiStatement(snap.photosReceived);
  const interviewCompleted = parseAiStatement(snap.interviewCompleted);
  const likelyScopeFit = parseAiStatement(snap.likelyScopeFit);
  if (
    !serviceRequested ||
    !urgency ||
    !projectStage ||
    !photosReceived ||
    !interviewCompleted ||
    !likelyScopeFit
  ) {
    return null;
  }

  const potentialRisks = parseAiStatementList(raw.potentialRisks);
  const risksNoneMessage =
    potentialRisks.length === 0
      ? String(raw.risksNoneMessage ?? "No obvious concerns identified.").trim() ||
        "No obvious concerns identified."
      : null;

  return {
    version: 1,
    overview: overview.slice(0, 3),
    snapshot: {
      serviceRequested,
      urgency,
      projectStage,
      preferredCompletionDate: snap.preferredCompletionDate
        ? parseAiStatement(snap.preferredCompletionDate)
        : null,
      photosReceived,
      interviewCompleted,
      likelyScopeFit,
    },
    keyFacts: parseAiStatementList(raw.keyFacts).slice(0, 12),
    itemsToVerify: parseAiStatementList(raw.itemsToVerify).slice(0, 8),
    potentialRisks: potentialRisks.slice(0, 5),
    risksNoneMessage,
    recommendedNextStep,
    generatedAt: new Date().toISOString(),
  };
}

function buildSystemPrompt(): string {
  return `You generate a Project Brief for a contractor reviewing an inbound quote request.

RULES:
- Never invent details. Only use information from the provided sources.
- Mark each statement confidence: "confirmed" (explicitly stated), "likely" (reasonable inference), or "needs_verification" (uncertain).
- Overview: 2-3 sentences summarizing the project for a contractor who has 10 seconds.
- itemsToVerify: professional verification items for the CONTRACTOR before quoting — NOT a list of what the customer forgot.
- potentialRisks: only real concerns supported by the data. If none, return empty array and risksNoneMessage "No obvious concerns identified."
- recommendedNextStep: exactly ONE actionable recommendation.
- Do not include chain-of-thought, reasoning, or meta commentary.

Return JSON only:
{
  "overview": [{"text": "...", "confidence": "confirmed|likely|needs_verification"}],
  "snapshot": {
    "serviceRequested": {"text": "...", "confidence": "..."},
    "urgency": {"text": "...", "confidence": "..."},
    "projectStage": {"text": "...", "confidence": "..."},
    "preferredCompletionDate": {"text": "...", "confidence": "..."} or null,
    "photosReceived": {"text": "...", "confidence": "..."},
    "interviewCompleted": {"text": "...", "confidence": "..."},
    "likelyScopeFit": {"text": "...", "confidence": "..."}
  },
  "keyFacts": [{"text": "...", "confidence": "..."}],
  "itemsToVerify": [{"text": "...", "confidence": "..."}],
  "potentialRisks": [{"text": "...", "confidence": "..."}],
  "risksNoneMessage": "No obvious concerns identified." or null,
  "recommendedNextStep": {"text": "...", "confidence": "..."}
}`;
}

function buildUserPrompt(input: {
  context: ProjectBriefContext;
  understanding: string;
  photoUrls: string[];
  scopeFitLabel: string | null;
  customerProblemLabel: string;
}): string {
  const { context, understanding, scopeFitLabel, customerProblemLabel } = input;
  const existing = context.existingBrief
    ? `\nEXISTING BRIEF (update incrementally — preserve confirmed facts unless contradicted):\n${JSON.stringify(context.existingBrief, null, 2)}`
    : "";

  return [
    understanding,
    "",
    `Customer name: ${context.customerName}`,
    `Interview completed: ${context.interviewCompleted ? "yes" : "no"}`,
    `Follow-up answers count: ${context.previousAnswers.length}`,
    scopeFitLabel ? `Likely scope fit: ${scopeFitLabel}` : "Likely scope fit: not yet assessed",
    context.scopeReason ? `Scope note: ${context.scopeReason}` : "",
    `Detected service/problem: ${customerProblemLabel}`,
    `Generation trigger: ${context.trigger}`,
    existing,
    input.photoUrls.length > 0
      ? `${input.photoUrls.length} photo(s) attached for visual review.`
      : "No photos attached.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateProjectBriefWithAi(input: {
  context: ProjectBriefContext;
  understanding: string;
  photoUrls: string[];
  scopeFitLabel: string | null;
  customerProblemLabel: string;
}): Promise<ProjectBrief | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" } }
  > = [{ type: "text", text: buildUserPrompt(input) }];

  for (const url of input.photoUrls.slice(0, MAX_BRIEF_PHOTOS)) {
    userContent.push({ type: "image_url", image_url: { url, detail: "low" } });
  }

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
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[project-brief] OpenAI error", response.status);
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = JSON.parse(content) as RawAiBrief;
    return parseAiBrief(parsed);
  } catch (error) {
    console.error("[project-brief] generation failed", error);
    return null;
  }
}
