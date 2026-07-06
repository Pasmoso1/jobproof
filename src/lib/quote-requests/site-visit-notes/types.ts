export const ORGANIZED_NOTE_SECTION_KEYS = [
  "measurements",
  "existing_conditions",
  "customer_requests",
  "materials",
  "access",
  "utilities",
  "safety",
  "risks",
  "additional_notes",
] as const;

export type OrganizedNoteSectionKey = (typeof ORGANIZED_NOTE_SECTION_KEYS)[number];

export const ORGANIZED_NOTE_SECTION_LABELS: Record<OrganizedNoteSectionKey, string> = {
  measurements: "Measurements",
  existing_conditions: "Existing Conditions",
  customer_requests: "Customer Requests",
  materials: "Materials",
  access: "Access",
  utilities: "Utilities",
  safety: "Safety",
  risks: "Risks",
  additional_notes: "Additional Notes",
};

export type OrganizedSiteVisitNotes = {
  version: 1;
  generatedAt: string;
  sections: Partial<Record<OrganizedNoteSectionKey, string[]>>;
};

export type SiteVisitVoiceSource = "browser_speech" | "audio_upload";

export type SiteVisitVoiceNote = {
  id: string;
  quoteRequestId: string;
  audioFilePath: string;
  mimeType: string;
  durationSeconds: number | null;
  transcription: string;
  source: SiteVisitVoiceSource;
  createdAt: string;
  signedAudioUrl: string | null;
};

export type SiteVisitPhoto = {
  id: string;
  quoteRequestId: string;
  filePath: string;
  caption: string | null;
  displayOrder: number;
  createdAt: string;
  signedUrl: string | null;
};

export type SiteVisitNotesRecord = {
  id: string;
  quoteRequestId: string;
  quickNotes: string;
  organizedNotes: OrganizedSiteVisitNotes | null;
  organizedNotesGeneratedAt: string | null;
  photos: SiteVisitPhoto[];
  voiceNotes: SiteVisitVoiceNote[];
};

export function isOrganizedNoteSectionKey(value: string): value is OrganizedNoteSectionKey {
  return (ORGANIZED_NOTE_SECTION_KEYS as readonly string[]).includes(value);
}

function parseSectionItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

export function parseOrganizedSiteVisitNotes(raw: unknown): OrganizedSiteVisitNotes | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return null;

  const generatedAt = String(obj.generatedAt ?? "").trim();
  if (!generatedAt) return null;

  const sectionsRaw = obj.sections;
  if (!sectionsRaw || typeof sectionsRaw !== "object") return null;

  const sections: Partial<Record<OrganizedNoteSectionKey, string[]>> = {};
  for (const [key, value] of Object.entries(sectionsRaw as Record<string, unknown>)) {
    if (!isOrganizedNoteSectionKey(key)) continue;
    const items = parseSectionItems(value);
    if (items.length > 0) {
      sections[key] = items;
    }
  }

  if (Object.keys(sections).length === 0) return null;

  return { version: 1, generatedAt, sections };
}

export function organizedNotesHasContent(notes: OrganizedSiteVisitNotes | null): boolean {
  if (!notes) return false;
  return Object.values(notes.sections).some((items) => (items?.length ?? 0) > 0);
}

export function nonEmptyOrganizedSections(
  notes: OrganizedSiteVisitNotes
): Array<{ key: OrganizedNoteSectionKey; label: string; items: string[] }> {
  return ORGANIZED_NOTE_SECTION_KEYS.filter((key) => (notes.sections[key]?.length ?? 0) > 0).map(
    (key) => ({
      key,
      label: ORGANIZED_NOTE_SECTION_LABELS[key],
      items: notes.sections[key] ?? [],
    })
  );
}
