export const QUOTE_BUILDER_SECTION_KEYS = [
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
  "pricing",
] as const;

export type QuoteBuilderSectionKey = (typeof QUOTE_BUILDER_SECTION_KEYS)[number];

export type QuoteBuilderStatus = "empty" | "draft" | "ready";

export const QUOTE_BUILDER_SECTION_LABELS: Record<QuoteBuilderSectionKey, string> = {
  project_summary: "Project Summary",
  scope_of_work: "Scope of Work",
  included_work: "Included Work",
  items_requiring_confirmation: "Items Requiring Confirmation",
  optional_upgrades: "Optional Upgrades",
  exclusions: "Exclusions",
  suggested_timeline: "Suggested Timeline",
  suggested_warranty: "Suggested Warranty Language",
  assumptions: "Assumptions",
  recommended_next_steps: "Recommended Next Steps",
  pricing: "Pricing",
};

export const QUOTE_BUILDER_SECTION_ORDER: Record<QuoteBuilderSectionKey, number> = {
  project_summary: 1,
  scope_of_work: 2,
  included_work: 3,
  items_requiring_confirmation: 4,
  optional_upgrades: 5,
  exclusions: 6,
  suggested_timeline: 7,
  suggested_warranty: 8,
  assumptions: 9,
  recommended_next_steps: 10,
  pricing: 11,
};

export type QuoteBuilderListContent = {
  version: 1;
  items: string[];
};

export type QuoteBuilderTimelineContent = {
  version: 1;
  text: string;
};

export type QuoteBuilderPricingContent = {
  version: 1;
  labour: string;
  materials: string;
  equipment: string;
  permits: string;
  other: string;
  subtotal: string;
  tax: string;
  total: string;
};

export type QuoteBuilderSectionContent =
  | QuoteBuilderListContent
  | QuoteBuilderTimelineContent
  | QuoteBuilderPricingContent;

export type QuoteBuilderSection = {
  id: string;
  quoteRequestId: string;
  contractorId: string;
  sectionKey: QuoteBuilderSectionKey;
  title: string;
  content: QuoteBuilderSectionContent;
  displayOrder: number;
  source: "generated" | "contractor";
  contractorEdited: boolean;
  contractorEditedAt: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QuoteBuilderDraft = {
  quoteRequestId: string;
  status: QuoteBuilderStatus;
  version: number;
  generatedAt: string | null;
  siteVisitBanner: boolean;
  sections: QuoteBuilderSection[];
};

export type QuoteBuilderSectionDraft = {
  sectionKey: QuoteBuilderSectionKey;
  title: string;
  content: QuoteBuilderSectionContent;
  displayOrder: number;
};

export function isQuoteBuilderSectionKey(value: string): value is QuoteBuilderSectionKey {
  return (QUOTE_BUILDER_SECTION_KEYS as readonly string[]).includes(value);
}

export function emptyPricingContent(): QuoteBuilderPricingContent {
  return {
    version: 1,
    labour: "",
    materials: "",
    equipment: "",
    permits: "",
    other: "",
    subtotal: "",
    tax: "",
    total: "",
  };
}

export function parseListContent(raw: unknown): QuoteBuilderListContent {
  if (!raw || typeof raw !== "object") return { version: 1, items: [] };
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.items)) return { version: 1, items: [] };
  return {
    version: 1,
    items: obj.items.map((item) => String(item ?? "").trim()).filter(Boolean),
  };
}

export function parseTimelineContent(raw: unknown): QuoteBuilderTimelineContent {
  if (!raw || typeof raw !== "object") {
    return { version: 1, text: "Timeline to be confirmed after site visit." };
  }
  const text = String((raw as Record<string, unknown>).text ?? "").trim();
  return {
    version: 1,
    text: text || "Timeline to be confirmed after site visit.",
  };
}

export function parsePricingContent(raw: unknown): QuoteBuilderPricingContent {
  const base = emptyPricingContent();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  const fields = ["labour", "materials", "equipment", "permits", "other", "subtotal", "tax", "total"] as const;
  const result = { ...base };
  for (const field of fields) {
    result[field] = obj[field] != null ? String(obj[field]) : "";
  }
  return result;
}

export function parseSectionContent(
  key: QuoteBuilderSectionKey,
  raw: unknown
): QuoteBuilderSectionContent {
  if (key === "pricing") return parsePricingContent(raw);
  if (key === "suggested_timeline") return parseTimelineContent(raw);
  return parseListContent(raw);
}

export function mapBuilderSectionRow(row: {
  id: string;
  quote_request_id: string;
  contractor_id: string;
  section_key: string;
  title: string;
  content: unknown;
  display_order: number;
  source: string;
  contractor_edited: boolean;
  contractor_edited_at: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}): QuoteBuilderSection | null {
  if (!isQuoteBuilderSectionKey(row.section_key)) return null;
  return {
    id: row.id,
    quoteRequestId: row.quote_request_id,
    contractorId: row.contractor_id,
    sectionKey: row.section_key,
    title: row.title,
    content: parseSectionContent(row.section_key, row.content),
    displayOrder: row.display_order,
    source: row.source === "contractor" ? "contractor" : "generated",
    contractorEdited: Boolean(row.contractor_edited),
    contractorEditedAt: row.contractor_edited_at,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listItemsToText(items: string[]): string {
  return items.join("\n");
}

export function textToListItems(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}
