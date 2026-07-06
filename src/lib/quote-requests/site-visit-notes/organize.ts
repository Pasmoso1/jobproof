import {
  isOrganizedNoteSectionKey,
  ORGANIZED_NOTE_SECTION_KEYS,
  type OrganizedNoteSectionKey,
  type OrganizedSiteVisitNotes,
} from "@/lib/quote-requests/site-visit-notes/types";
import { organizeSiteVisitNotesFallback } from "@/lib/quote-requests/site-visit-notes/fallback";

type RawAiOrganized = {
  sections?: Record<string, unknown>;
};

function parseAiSections(raw: RawAiOrganized): Partial<Record<OrganizedNoteSectionKey, string[]>> {
  const sections: Partial<Record<OrganizedNoteSectionKey, string[]>> = {};
  const source = raw.sections ?? {};

  for (const key of ORGANIZED_NOTE_SECTION_KEYS) {
    const value = source[key];
    if (!Array.isArray(value)) continue;
    const items = value
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0);
    if (items.length > 0) {
      sections[key] = items;
    }
  }

  for (const [key, value] of Object.entries(source)) {
    if (!isOrganizedNoteSectionKey(key)) continue;
    if (sections[key]?.length) continue;
    if (!Array.isArray(value)) continue;
    const items = value
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0);
    if (items.length > 0) {
      sections[key] = items;
    }
  }

  return sections;
}

function buildSystemPrompt(): string {
  const sectionList = ORGANIZED_NOTE_SECTION_KEYS.join(", ");
  return `You organize contractor site visit notes into structured sections for a construction quoting workflow.

Rules:
- Use ONLY information explicitly stated in the contractor's quick notes.
- NEVER invent measurements, materials, conditions, or customer requests.
- NEVER remove or summarize away contractor observations — preserve every distinct observation.
- Remove exact duplicate lines only.
- If uncertain where an observation belongs, put it in additional_notes.
- Only include sections that have at least one observation.
- Each observation should be a short bullet string (one fact per item).

Return JSON:
{
  "sections": {
    "measurements": ["..."],
    "existing_conditions": ["..."],
    "customer_requests": ["..."],
    "materials": ["..."],
    "access": ["..."],
    "utilities": ["..."],
    "safety": ["..."],
    "risks": ["..."],
    "additional_notes": ["..."]
  }
}

Valid section keys: ${sectionList}
Omit empty sections entirely.`;
}

export async function organizeSiteVisitNotesWithAi(
  quickNotes: string
): Promise<OrganizedSiteVisitNotes | null> {
  const trimmed = quickNotes.trim();
  if (!trimmed) return null;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return organizeSiteVisitNotesFallback(trimmed);
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
        temperature: 0.1,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          {
            role: "user",
            content: `Organize these contractor site visit quick notes:\n\n${trimmed}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[organizeSiteVisitNotesWithAi] OpenAI error", response.status);
      return organizeSiteVisitNotesFallback(trimmed);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return organizeSiteVisitNotesFallback(trimmed);

    const parsed = JSON.parse(content) as RawAiOrganized;
    const sections = parseAiSections(parsed);
    if (Object.keys(sections).length === 0) {
      return organizeSiteVisitNotesFallback(trimmed);
    }

    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      sections,
    };
  } catch (err) {
    console.error("[organizeSiteVisitNotesWithAi]", err);
    return organizeSiteVisitNotesFallback(trimmed);
  }
}
