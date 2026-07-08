import type {
  QuoteBuilderListContent,
  QuoteBuilderPricingContent,
  QuoteBuilderSection,
  QuoteBuilderTimelineContent,
} from "@/lib/quote-requests/quote-builder/types";

export type ProposalPricingLineItem = {
  label: string;
  amount: number;
  description?: string | null;
};

export type ProposalOptionalUpgrade = {
  title: string;
  description: string | null;
  additionalPrice: number | null;
};

export type ProposalTimeline = {
  duration: string | null;
  startWindow: string | null;
  completion: string | null;
  fallbackText: string | null;
};

export type CustomerProposalSnapshot = {
  welcomeMessage: string;
  projectTitle: string;
  projectSummary: string | null;
  scopeOfWork: string[];
  includedWork: string[];
  optionalUpgrades: ProposalOptionalUpgrade[];
  exclusions: string[];
  pricingItems: ProposalPricingLineItem[];
  timeline: ProposalTimeline;
  warranty: string | null;
  questionsOrChangesIntro: string;
  nextSteps: string[];
  subtotal: number;
  taxAmount: number;
  taxRateLabel: string;
  total: number;
  depositAmount: number | null;
};

function listItems(sections: QuoteBuilderSection[], key: QuoteBuilderSection["sectionKey"]): string[] {
  const section = sections.find((item) => item.sectionKey === key);
  if (!section) return [];
  return ((section.content as QuoteBuilderListContent).items ?? []).filter(Boolean);
}

function timelineText(sections: QuoteBuilderSection[]): string {
  const section = sections.find((item) => item.sectionKey === "suggested_timeline");
  if (!section) return "";
  return String((section.content as QuoteBuilderTimelineContent).text ?? "").trim();
}

function pricingContent(sections: QuoteBuilderSection[]): QuoteBuilderPricingContent {
  const section = sections.find((item) => item.sectionKey === "pricing");
  const base: QuoteBuilderPricingContent = {
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
  if (!section) return base;
  return { ...base, ...(section.content as Partial<QuoteBuilderPricingContent>) };
}

function parseMoney(raw: string | null | undefined): number {
  const cleaned = String(raw ?? "").replace(/[^0-9.-]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(.+?[.!?])(\s|$)/);
  return (match?.[1] ?? trimmed).trim();
}

function buildWelcomeMessage(projectTitle: string, businessName: string): string {
  const title = projectTitle.trim() || "your project";
  const business = businessName.trim() || "our team";
  const templates = [
    `Thank you for the opportunity to prepare a quote for ${title}. Below is a clear summary of the work ${business} is proposing.`,
    `We appreciate the chance to quote ${title}. Here is a straightforward proposal outlining the work, timing, and pricing.`,
    `Thanks for considering ${business} for ${title}. This proposal walks through the work we are recommending and what to expect next.`,
  ];
  const seed = `${title}|${business}`.length % templates.length;
  return templates[seed];
}

function splitUpgradeLine(raw: string): ProposalOptionalUpgrade {
  const trimmed = raw.trim();
  const priceMatch = trimmed.match(
    /\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)\s*$/
  );
  const additionalPrice = priceMatch ? parseMoney(priceMatch[1]) : null;
  const withoutPrice = priceMatch
    ? trimmed.slice(0, trimmed.lastIndexOf(priceMatch[0])).trim().replace(/[-:–]\s*$/, "")
    : trimmed;

  const parts = withoutPrice.split(/\s[-:]\s|\s[–]\s/);
  const title = parts[0]?.trim() || "Optional upgrade";
  const description = parts.slice(1).join(" — ").trim() || null;
  return { title, description, additionalPrice };
}

function buildPricingItems(
  sections: QuoteBuilderSection[],
  subtotal: number
): ProposalPricingLineItem[] {
  const pricing = pricingContent(sections);
  const permits = parseMoney(pricing.permits);
  const other = parseMoney(pricing.other);
  const mainAmount = Math.max(0, subtotal - permits - other);
  const scope = listItems(sections, "scope_of_work");
  const summary = listItems(sections, "project_summary");
  const primaryLabel =
    firstSentence(scope[0] ?? "") ||
    firstSentence(summary[0] ?? "") ||
    "Complete project work";

  const items: ProposalPricingLineItem[] = [];
  if (mainAmount > 0) {
    items.push({
      label: primaryLabel,
      amount: mainAmount,
      description: scope.length > 1 ? firstSentence(scope[1] ?? "") || null : null,
    });
  }
  if (permits > 0) {
    items.push({
      label: "Permits and required coordination",
      amount: permits,
      description: "Any standard permits or coordination already included in this quote.",
    });
  }
  if (other > 0) {
    items.push({
      label: "Finishing details and project closeout",
      amount: other,
      description: "Any remaining quoted work needed to complete the project as proposed.",
    });
  }
  if (!items.length && subtotal > 0) {
    items.push({ label: "Complete project work", amount: subtotal, description: null });
  }
  return items;
}

function buildTimeline(text: string): ProposalTimeline {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      duration: null,
      startWindow: null,
      completion: null,
      fallbackText: "Scheduling will be confirmed after acceptance.",
    };
  }

  const durationMatch = trimmed.match(/(?:estimated duration|duration)\s*[:\-]\s*(.+)/i);
  const startMatch = trimmed.match(/(?:start window|start)\s*[:\-]\s*(.+)/i);
  const completionMatch = trimmed.match(/(?:completion|finish|estimated completion)\s*[:\-]\s*(.+)/i);

  const duration = durationMatch?.[1]?.split(/\n|\. /)[0]?.trim() || null;
  const startWindow = startMatch?.[1]?.split(/\n|\. /)[0]?.trim() || null;
  const completion = completionMatch?.[1]?.split(/\n|\. /)[0]?.trim() || null;

  if (duration || startWindow || completion) {
    return {
      duration,
      startWindow,
      completion,
      fallbackText: null,
    };
  }

  return {
    duration: null,
    startWindow: null,
    completion: null,
    fallbackText: trimmed,
  };
}

export function buildCustomerProposalSnapshot(input: {
  sections: QuoteBuilderSection[];
  projectTitle: string;
  businessName: string;
  subtotal: number;
  taxAmount: number;
  taxRateLabel: string;
  total: number;
  depositAmount: number | null;
}): CustomerProposalSnapshot {
  const projectSummaryItems = listItems(input.sections, "project_summary");
  const scopeOfWork = listItems(input.sections, "scope_of_work");
  const includedWork = listItems(input.sections, "included_work");
  const optionalUpgrades = listItems(input.sections, "optional_upgrades").map(splitUpgradeLine);
  const exclusions = listItems(input.sections, "exclusions");
  const nextSteps = listItems(input.sections, "recommended_next_steps");
  const warrantyItems = listItems(input.sections, "suggested_warranty");
  const timeline = buildTimeline(timelineText(input.sections));

  return {
    welcomeMessage: buildWelcomeMessage(input.projectTitle, input.businessName),
    projectTitle: input.projectTitle,
    projectSummary: projectSummaryItems.join(" ").trim() || null,
    scopeOfWork,
    includedWork,
    optionalUpgrades,
    exclusions,
    pricingItems: buildPricingItems(input.sections, input.subtotal),
    timeline,
    warranty: warrantyItems.join("\n").trim() || null,
    questionsOrChangesIntro:
      "If you have a question or would like anything adjusted, send a note here and your contractor will review it with this quote.",
    nextSteps,
    subtotal: input.subtotal,
    taxAmount: input.taxAmount,
    taxRateLabel: input.taxRateLabel,
    total: input.total,
    depositAmount: input.depositAmount,
  };
}
