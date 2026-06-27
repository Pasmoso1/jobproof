import type { SpecialtyClassification, SpecialtyKey } from "@/lib/quote-requests/specialty/types";

function combinedText(projectType: string, description: string): string {
  return `${projectType} ${description}`.toLowerCase();
}

const EXTERIOR_DRAINAGE_PATTERN =
  /\bwater pool(s|ing)?\s+(against|near|at|by)\s+(the\s+)?foundation\b|\bgrading\b|\bnegative grade\b|\bdrainage\s+(issue|problem|help)\b|\bwater runs toward\s+(the\s+)?(house|foundation|home)\b|\bdownspout(s)?\s+(near|at|against)\s+(the\s+)?foundation/i;

const FOUNDATION_WATERPROOFING_PATTERNS: RegExp[] = [
  /\bfoundation crack/i,
  /\bcrack in (my )?foundation/i,
  /\bbasement leak/i,
  /\bleak(ing|s)?\s+(into\s+)?(the\s+)?basement/i,
  /\bbasement.{0,40}(leak|water|moisture|wet|damp)/i,
  /\b(leak|water|moisture|wet).{0,40}basement/i,
  /\bwater intrusion/i,
  /\bwaterproof/i,
  /\bfoundation repair/i,
  /\bsump pump/i,
  /\bweeping tile/i,
  /\bweeper tile/i,
  /\bbasement moisture/i,
  /\bconcrete crack repair/i,
  /\bfoundation.{0,30}leak/i,
  /\bleak.{0,30}foundation/i,
  /\bseepage/i,
  /\bwater coming in/i,
];

const URGENT_LEAK_PATTERN =
  /\b(active(ly)? leak|leaking now|standing water|water coming in now|currently leak|wet now|flooding)\b/i;

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function isExteriorDrainagePrimary(text: string): boolean {
  if (!EXTERIOR_DRAINAGE_PATTERN.test(text)) return false;
  const hasInteriorBasement =
    /\bbasement leak\b|\bleak(ing)?\s+(into\s+)?(the\s+)?basement/i.test(text) ||
    /\bfoundation crack\b|\bcrack in (my )?foundation/i.test(text);
  const hasPooling =
    /\bwater pool(s|ing)?\s+(against|near|at|by)\s+(the\s+)?foundation/i.test(text);
  return hasPooling && !hasInteriorBasement;
}

/**
 * Detect job-specific specialty before generic trade library selection.
 */
export function detectSpecialty(
  projectType: string,
  description: string
): SpecialtyClassification | null {
  const text = combinedText(projectType, description);

  if (isExteriorDrainagePrimary(text)) {
    return {
      key: "exterior_drainage",
      label: "Exterior drainage / grading / water pooling near foundation",
      urgent: /\bpool(s|ing)? during rain\b|\bevery rain\b|\bstanding water\b/i.test(text),
      confidence: "high",
    };
  }

  if (matchesAny(text, FOUNDATION_WATERPROOFING_PATTERNS)) {
    return {
      key: "foundation_waterproofing",
      label: "Foundation crack / basement leak / waterproofing / water intrusion",
      urgent:
        URGENT_LEAK_PATTERN.test(text) ||
        /\bleak(ing|s)?\b/i.test(text) ||
        /\bwater coming in\b/i.test(text),
      confidence: "high",
    };
  }

  if (EXTERIOR_DRAINAGE_PATTERN.test(text)) {
    return {
      key: "exterior_drainage",
      label: "Exterior drainage / grading near foundation",
      urgent: false,
      confidence: "medium",
    };
  }

  return null;
}

export function getSpecialtyLabel(key: SpecialtyKey): string {
  if (key === "foundation_waterproofing") {
    return "Foundation / basement leak / waterproofing";
  }
  return "Exterior drainage / grading near foundation";
}
