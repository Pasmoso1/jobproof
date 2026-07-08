import { computeEstimateTotals } from "@/lib/estimate-pricing";
import { parseQuoteRequestPropertyAddress } from "@/lib/quote-requests/parse-property-address";
import {
  type QuoteBuilderListContent,
  type QuoteBuilderPricingContent,
  type QuoteBuilderSection,
  type QuoteBuilderTimelineContent,
} from "@/lib/quote-requests/quote-builder/types";
import { validateScopeOfWork } from "@/lib/validation/job-create";

export type BuilderEstimateFields = {
  title: string;
  scopeOfWork: string;
  notes: string | null;
  propertyAddressLine1: string;
  propertyAddressLine2: string | null;
  propertyCity: string;
  propertyProvince: string;
  propertyPostalCode: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
};

function sectionByKey(
  sections: QuoteBuilderSection[],
  key: QuoteBuilderSection["sectionKey"]
): QuoteBuilderSection | undefined {
  return sections.find((s) => s.sectionKey === key);
}

function listItems(sections: QuoteBuilderSection[], key: QuoteBuilderSection["sectionKey"]): string[] {
  const section = sectionByKey(sections, key);
  if (!section) return [];
  return (section.content as QuoteBuilderListContent).items ?? [];
}

function timelineText(sections: QuoteBuilderSection[]): string {
  const section = sectionByKey(sections, "suggested_timeline");
  if (!section) return "";
  return String((section.content as QuoteBuilderTimelineContent).text ?? "").trim();
}

function parseMoney(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function buildScopeOfWork(sections: QuoteBuilderSection[]): string {
  const scope = listItems(sections, "scope_of_work");
  const included = listItems(sections, "included_work");
  const summary = listItems(sections, "project_summary");

  const parts: string[] = [];
  if (summary.length) {
    parts.push(summary.join("\n"));
  }
  if (scope.length) {
    parts.push(scope.map((item) => `• ${item}`).join("\n"));
  }
  if (included.length) {
    parts.push(`Included work:\n${included.map((item) => `• ${item}`).join("\n")}`);
  }
  return parts.join("\n\n").trim();
}

function buildEstimateNotes(sections: QuoteBuilderSection[]): string | null {
  const blocks: string[] = [];

  const listSections: Array<{ key: QuoteBuilderSection["sectionKey"]; heading: string }> = [
    { key: "items_requiring_confirmation", heading: "Items requiring confirmation" },
    { key: "optional_upgrades", heading: "Optional upgrades" },
    { key: "exclusions", heading: "Exclusions" },
    { key: "assumptions", heading: "Assumptions" },
    { key: "suggested_warranty", heading: "Warranty" },
    { key: "recommended_next_steps", heading: "Notes" },
  ];

  for (const { key, heading } of listSections) {
    const items = listItems(sections, key);
    if (items.length) {
      blocks.push(`${heading}:\n${items.map((item) => `• ${item}`).join("\n")}`);
    }
  }

  const timeline = timelineText(sections);
  if (timeline) {
    blocks.push(`Timeline:\n${timeline}`);
  }

  const joined = blocks.join("\n\n").trim();
  return joined || null;
}

export function buildEstimateFieldsFromQuoteBuilder(input: {
  sections: QuoteBuilderSection[];
  projectType: string;
  propertyAddress: string;
  profileProvince: string | null;
  taxRate: number;
}): BuilderEstimateFields | { error: string } {
  const scopeOfWork = buildScopeOfWork(input.sections);
  const scopeErr = validateScopeOfWork(scopeOfWork);
  if (scopeErr) return { error: scopeErr };

  const pricingSection = sectionByKey(input.sections, "pricing");
  const pricing = (pricingSection?.content ?? {
    version: 1,
    labour: "",
    materials: "",
    equipment: "",
    permits: "",
    other: "",
    subtotal: "",
    tax: "",
    total: "",
  }) as QuoteBuilderPricingContent;

  let subtotal = parseMoney(pricing.subtotal);
  if (subtotal <= 0) {
    subtotal =
      parseMoney(pricing.labour) +
      parseMoney(pricing.materials) +
      parseMoney(pricing.equipment) +
      parseMoney(pricing.permits) +
      parseMoney(pricing.other);
  }

  if (subtotal <= 0) {
    return { error: "Enter pricing with a subtotal or total before sending." };
  }

  const taxRate = input.taxRate;
  let taxAmount = parseMoney(pricing.tax);
  let total = parseMoney(pricing.total);

  if (total <= 0) {
    const computed = computeEstimateTotals(subtotal, taxRate);
    taxAmount = computed.taxAmount;
    total = computed.total;
  } else if (taxAmount <= 0) {
    taxAmount = Math.max(0, Math.round((total - subtotal) * 100) / 100);
  }

  const summaryItems = listItems(input.sections, "project_summary");
  const title =
    summaryItems[0]?.trim() ||
    input.projectType.trim() ||
    "Project estimate";

  const address = parseQuoteRequestPropertyAddress(
    input.propertyAddress,
    input.profileProvince
  );

  return {
    title: title.slice(0, 200),
    scopeOfWork,
    notes: buildEstimateNotes(input.sections),
    propertyAddressLine1: address.propertyAddressLine1,
    propertyAddressLine2: null,
    propertyCity: address.propertyCity,
    propertyProvince: address.propertyProvince,
    propertyPostalCode: address.propertyPostalCode,
    subtotal,
    taxRate,
    taxAmount,
    total,
  };
}

/** Human-readable validation summary for the Send Quote button. */
export function validateQuoteBuilderForSend(sections: QuoteBuilderSection[]): string | null {
  if (!sections.length) {
    return "Create a quote before sending.";
  }
  const result = buildEstimateFieldsFromQuoteBuilder({
    sections,
    projectType: "Project",
    propertyAddress: "123 Main St, Toronto, ON M5V 1A1",
    profileProvince: "ON",
    taxRate: 0.13,
  });
  if ("error" in result) return result.error;
  return null;
}
