import {
  ORGANIZED_NOTE_SECTION_KEYS,
  type OrganizedNoteSectionKey,
  type OrganizedSiteVisitNotes,
} from "@/lib/quote-requests/site-visit-notes/types";

function splitIntoObservations(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function guessSection(line: string): OrganizedNoteSectionKey {
  const lower = line.toLowerCase();

  if (/\b\d+['"]|\b\d+\s*(ft|feet|inch|inches|cm|mm|m|meter|sq\.?\s*ft|square)\b/.test(lower)) {
    return "measurements";
  }
  if (/\b(requested|wants|prefers|asked for|would like)\b/.test(lower)) {
    return "customer_requests";
  }
  if (/\b(material|tile|wood|drywall|concrete|paint|insulation|lumber|pipe|wire)\b/.test(lower)) {
    return "materials";
  }
  if (/\b(access|stairs|gate|parking|entry|ladder|narrow|clearance)\b/.test(lower)) {
    return "access";
  }
  if (/\b(utilit|electric|plumb|gas line|water|drain|hvac|panel)\b/.test(lower)) {
    return "utilities";
  }
  if (/\b(safety|hazard|ppe|asbestos|lead|mold|fall protection)\b/.test(lower)) {
    return "safety";
  }
  if (/\b(risk|concern|issue|problem|unknown|uncertain)\b/.test(lower)) {
    return "risks";
  }
  if (/\b(condition|existing|current|damage|wear|age|old|new)\b/.test(lower)) {
    return "existing_conditions";
  }
  return "additional_notes";
}

export function organizeSiteVisitNotesFallback(quickNotes: string): OrganizedSiteVisitNotes | null {
  const trimmed = quickNotes.trim();
  if (!trimmed) return null;

  const sections: Partial<Record<OrganizedNoteSectionKey, string[]>> = {};
  for (const observation of splitIntoObservations(trimmed)) {
    const key = guessSection(observation);
    if (!sections[key]) sections[key] = [];
    sections[key]!.push(observation);
  }

  if (Object.keys(sections).length === 0) {
    sections.additional_notes = [trimmed];
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sections,
  };
}

export function emptyOrganizedSections(): Record<OrganizedNoteSectionKey, string[]> {
  return ORGANIZED_NOTE_SECTION_KEYS.reduce(
    (acc, key) => {
      acc[key] = [];
      return acc;
    },
    {} as Record<OrganizedNoteSectionKey, string[]>
  );
}
