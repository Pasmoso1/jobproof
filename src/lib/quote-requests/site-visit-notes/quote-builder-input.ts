import {
  nonEmptyOrganizedSections,
  type SiteVisitNotesRecord,
  type SiteVisitPhoto,
  type SiteVisitVoiceNote,
} from "@/lib/quote-requests/site-visit-notes/types";

/** Structured input for the future AI Quote Builder. */
export type QuoteBuilderSiteVisitInput = {
  version: 1;
  quoteRequestId: string;
  quickNotes: string;
  organizedSections: Array<{
    key: string;
    label: string;
    observations: string[];
  }>;
  photoCount: number;
  voiceTranscriptions: string[];
  capturedAt: string;
};

export function buildQuoteBuilderSiteVisitInput(
  record: SiteVisitNotesRecord
): QuoteBuilderSiteVisitInput | null {
  const hasQuickNotes = record.quickNotes.trim().length > 0;
  const hasOrganized = record.organizedNotes !== null;
  const hasPhotos = record.photos.length > 0;
  const hasVoice = record.voiceNotes.some((v) => v.transcription.trim().length > 0);

  if (!hasQuickNotes && !hasOrganized && !hasPhotos && !hasVoice) {
    return null;
  }

  const organizedSections = record.organizedNotes
    ? nonEmptyOrganizedSections(record.organizedNotes).map((section) => ({
        key: section.key,
        label: section.label,
        observations: section.items,
      }))
    : [];

  const timestamps = [
    record.organizedNotesGeneratedAt,
    ...record.photos.map((p) => p.createdAt),
    ...record.voiceNotes.map((v) => v.createdAt),
  ].filter((value): value is string => Boolean(value));

  const capturedAt =
    timestamps.sort().at(-1) ?? record.organizedNotes?.generatedAt ?? new Date().toISOString();

  return {
    version: 1,
    quoteRequestId: record.quoteRequestId,
    quickNotes: record.quickNotes.trim(),
    organizedSections,
    photoCount: record.photos.length,
    voiceTranscriptions: record.voiceNotes
      .map((note) => note.transcription.trim())
      .filter((text) => text.length > 0),
    capturedAt,
  };
}

export function mapSiteVisitPhotoRow(
  row: {
    id: string;
    quote_request_id: string;
    file_path: string;
    caption: string | null;
    display_order: number;
    created_at: string;
  },
  signedUrl: string | null
): SiteVisitPhoto {
  return {
    id: row.id,
    quoteRequestId: row.quote_request_id,
    filePath: row.file_path,
    caption: row.caption,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    signedUrl,
  };
}

export function mapSiteVisitVoiceRow(
  row: {
    id: string;
    quote_request_id: string;
    audio_file_path: string;
    mime_type: string;
    duration_seconds: number | null;
    transcription: string;
    source: string;
    created_at: string;
  },
  signedAudioUrl: string | null
): SiteVisitVoiceNote {
  return {
    id: row.id,
    quoteRequestId: row.quote_request_id,
    audioFilePath: row.audio_file_path,
    mimeType: row.mime_type,
    durationSeconds:
      row.duration_seconds != null ? Number(row.duration_seconds) : null,
    transcription: row.transcription,
    source: row.source === "browser_speech" ? "browser_speech" : "audio_upload",
    createdAt: row.created_at,
    signedAudioUrl,
  };
}
