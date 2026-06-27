import type { LibraryTradeKey } from "@/lib/quote-requests/question-library/types";

const PROFILE_TRADE_TO_LIBRARY: Record<string, LibraryTradeKey> = {
  Painter: "painter",
  Landscaper: "landscaping",
  Renovator: "general_renovation",
  Handyman: "handyman",
  Roofer: "roofer",
  HVAC: "hvac",
  Plumber: "plumber",
  Electrician: "electrician",
  Flooring: "flooring",
  "Deck/Fence": "deck_fence",
  Other: "other",
};

function inferTradeFromText(text: string): LibraryTradeKey | null {
  const p = text.toLowerCase();

  if (/\bkitchen\b/.test(p)) return "kitchen_renovation";
  if (/\bbath(room)?\b/.test(p)) return "bathroom_renovation";
  if (/\bdeck\b|\bfence\b|\bpatio\b/.test(p)) return "deck_fence";
  if (/\blandscap|\blawn|\bgarden\b|\bsod\b/.test(p)) return "landscaping";
  if (/\bconcrete\b|\bdriveway\b|\bsidewalk\b|\bpatio slab\b/.test(p)) return "concrete";
  if (/\bwindow|\bdoor\b|\bentry door\b/.test(p)) return "windows_doors";
  if (/\bfloor(ing)?\b|\btile\b|\bhardwood\b/.test(p)) return "flooring";
  if (/\broof(ing)?\b|\bshingle\b|\bgutter\b/.test(p)) return "roofer";
  if (/\bhvac\b|\bfurnace\b|\bair condition|\bheat pump\b|\bac unit\b/.test(p)) return "hvac";
  if (/\bplumb|\bdrain|\bwater heater\b|\bfaucet\b|\btoilet\b/.test(p)) return "plumber";
  if (/\belectric|\bpanel\b|\bwiring\b|\boutlet\b|\blight(ing)?\b/.test(p)) return "electrician";
  if (/\bpaint(ing)?\b|\bwall(s)?\b/.test(p)) return "painter";
  if (/\brenovat|\bremodel\b|\bdrywall\b/.test(p)) return "general_renovation";
  if (/\bfence\b/.test(p)) return "deck_fence";
  if (
    /\bfoundation crack|\bbasement leak|\bwaterproof|\bweeping tile|\bsump pump|\bwater intrusion|\bfoundation repair|\bbasement moisture|\bconcrete crack/i.test(
      p
    )
  ) {
    return "concrete";
  }

  return null;
}

/**
 * Resolve which library trade pools apply to a quote request.
 */
export function resolveLibraryTrades(input: {
  primaryTrade: string | null;
  primaryTradeOther: string | null;
  projectType: string;
  description?: string;
}): LibraryTradeKey[] {
  const trades = new Set<LibraryTradeKey>();

  const profileTrade = input.primaryTrade?.trim();
  if (profileTrade && PROFILE_TRADE_TO_LIBRARY[profileTrade]) {
    trades.add(PROFILE_TRADE_TO_LIBRARY[profileTrade]);
  }

  if (profileTrade === "Other") {
    const custom = input.primaryTradeOther?.trim();
    if (custom) {
      const inferred = inferTradeFromText(custom);
      trades.add(inferred ?? "other");
    }
  }

  const fromProject = inferTradeFromText(input.projectType);
  if (fromProject) {
    trades.add(fromProject);
  }

  const fromDescription = input.description?.trim()
    ? inferTradeFromText(input.description)
    : null;
  if (fromDescription) {
    trades.add(fromDescription);
  }

  if (trades.size === 0) {
    trades.add("general_renovation");
  }

  return Array.from(trades);
}
