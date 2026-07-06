"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateUUID } from "@/lib/utils/uuid";
import { QUOTE_REQUEST_STORAGE_BUCKET } from "@/lib/quote-requests/constants";
import { organizeSiteVisitNotesWithAi } from "@/lib/quote-requests/site-visit-notes/organize";
import {
  buildSiteVisitPhotoPath,
  buildSiteVisitVoicePath,
  extFromSiteVisitAudioMime,
  extFromSiteVisitPhotoMime,
  isValidSiteVisitPhotoPath,
  isValidSiteVisitVoicePath,
  validateSiteVisitAudioMeta,
  validateSiteVisitPhotoCount,
  validateSiteVisitPhotoMeta,
} from "@/lib/quote-requests/site-visit-notes/photo-upload";
import {
  mapSiteVisitPhotoRow,
  mapSiteVisitVoiceRow,
} from "@/lib/quote-requests/site-visit-notes/quote-builder-input";
import { transcribeAudioWithWhisper } from "@/lib/quote-requests/site-visit-notes/transcribe";
import {
  parseOrganizedSiteVisitNotes,
  type OrganizedSiteVisitNotes,
  type SiteVisitNotesRecord,
} from "@/lib/quote-requests/site-visit-notes/types";

type ActionError = { success: false; error: string };

async function requireProfileAndRequest(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.id) {
    return { supabase, profileId: null as string | null, request: null };
  }

  const { data: request } = await supabase
    .from("quote_requests")
    .select("id, contractor_id")
    .eq("id", requestId)
    .eq("contractor_id", profile.id)
    .maybeSingle();

  return { supabase, profileId: profile.id, request };
}

async function ensureSiteVisitNotesRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
  contractorId: string
) {
  const { data: existing } = await supabase
    .from("quote_request_site_visit_notes")
    .select("id")
    .eq("quote_request_id", requestId)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("quote_request_site_visit_notes")
    .insert({
      quote_request_id: requestId,
      contractor_id: contractorId,
      quick_notes: "",
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[ensureSiteVisitNotesRow]", error);
    return null;
  }
  return created.id;
}

export async function loadSiteVisitNotesRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string
): Promise<SiteVisitNotesRecord> {
  const empty: SiteVisitNotesRecord = {
    id: "",
    quoteRequestId: requestId,
    quickNotes: "",
    organizedNotes: null,
    organizedNotesGeneratedAt: null,
    photos: [],
    voiceNotes: [],
  };

  const { data: notesRow } = await supabase
    .from("quote_request_site_visit_notes")
    .select("*")
    .eq("quote_request_id", requestId)
    .maybeSingle();

  const { data: photoRows } = await supabase
    .from("quote_request_site_visit_photos")
    .select("*")
    .eq("quote_request_id", requestId)
    .order("display_order", { ascending: true });

  const { data: voiceRows } = await supabase
    .from("quote_request_site_visit_voice_notes")
    .select("*")
    .eq("quote_request_id", requestId)
    .order("created_at", { ascending: false });

  const photos = await Promise.all(
    (photoRows ?? []).map(async (row) => {
      const { data: signed } = await supabase.storage
        .from(QUOTE_REQUEST_STORAGE_BUCKET)
        .createSignedUrl(row.file_path, 3600);
      return mapSiteVisitPhotoRow(row, signed?.signedUrl ?? null);
    })
  );

  const voiceNotes = await Promise.all(
    (voiceRows ?? []).map(async (row) => {
      const { data: signed } = await supabase.storage
        .from(QUOTE_REQUEST_STORAGE_BUCKET)
        .createSignedUrl(row.audio_file_path, 3600);
      return mapSiteVisitVoiceRow(row, signed?.signedUrl ?? null);
    })
  );

  if (!notesRow) {
    return { ...empty, photos, voiceNotes };
  }

  return {
    id: notesRow.id,
    quoteRequestId: requestId,
    quickNotes: notesRow.quick_notes ?? "",
    organizedNotes: parseOrganizedSiteVisitNotes(notesRow.organized_notes),
    organizedNotesGeneratedAt: notesRow.organized_notes_generated_at,
    photos,
    voiceNotes,
  };
}

export type SaveSiteVisitQuickNotesResult =
  | { success: true; quickNotes: string }
  | ActionError;

export async function saveSiteVisitQuickNotes(
  requestId: string,
  quickNotes: string
): Promise<SaveSiteVisitQuickNotesResult> {
  const { supabase, profileId, request } = await requireProfileAndRequest(requestId);
  if (!profileId || !request) {
    return { success: false, error: "Quote request not found." };
  }

  const notesId = await ensureSiteVisitNotesRow(supabase, requestId, profileId);
  if (!notesId) {
    return { success: false, error: "Could not save notes." };
  }

  const { error } = await supabase
    .from("quote_request_site_visit_notes")
    .update({ quick_notes: quickNotes })
    .eq("id", notesId)
    .eq("contractor_id", profileId);

  if (error) {
    console.error("[saveSiteVisitQuickNotes]", error);
    return { success: false, error: "Could not save notes." };
  }

  revalidatePath(`/quote-requests/${requestId}`);
  return { success: true, quickNotes };
}

export type OrganizeSiteVisitNotesResult =
  | { success: true; organized: OrganizedSiteVisitNotes }
  | ActionError;

export async function previewOrganizeSiteVisitNotes(
  requestId: string
): Promise<OrganizeSiteVisitNotesResult> {
  const { supabase, profileId, request } = await requireProfileAndRequest(requestId);
  if (!profileId || !request) {
    return { success: false, error: "Quote request not found." };
  }

  const record = await loadSiteVisitNotesRecord(supabase, requestId);
  const trimmed = record.quickNotes.trim();
  if (!trimmed) {
    return { success: false, error: "Add quick notes before organizing." };
  }

  const organized = await organizeSiteVisitNotesWithAi(trimmed);
  if (!organized) {
    return { success: false, error: "Could not organize notes. Try adding more detail." };
  }

  return { success: true, organized };
}

export type SaveOrganizedSiteVisitNotesResult =
  | { success: true; organized: OrganizedSiteVisitNotes }
  | ActionError;

export async function saveOrganizedSiteVisitNotes(
  requestId: string,
  organized: OrganizedSiteVisitNotes
): Promise<SaveOrganizedSiteVisitNotesResult> {
  const { supabase, profileId, request } = await requireProfileAndRequest(requestId);
  if (!profileId || !request) {
    return { success: false, error: "Quote request not found." };
  }

  const notesId = await ensureSiteVisitNotesRow(supabase, requestId, profileId);
  if (!notesId) {
    return { success: false, error: "Could not save organized notes." };
  }

  const { error } = await supabase
    .from("quote_request_site_visit_notes")
    .update({
      organized_notes: organized,
      organized_notes_generated_at: organized.generatedAt,
    })
    .eq("id", notesId)
    .eq("contractor_id", profileId);

  if (error) {
    console.error("[saveOrganizedSiteVisitNotes]", error);
    return { success: false, error: "Could not save organized notes." };
  }

  revalidatePath(`/quote-requests/${requestId}`);
  return { success: true, organized };
}

export type ReplaceQuickNotesFromOrganizedResult =
  | { success: true; quickNotes: string }
  | ActionError;

export async function replaceQuickNotesFromOrganized(
  requestId: string,
  organized: OrganizedSiteVisitNotes
): Promise<ReplaceQuickNotesFromOrganizedResult> {
  const sections = Object.entries(organized.sections)
    .filter(([, items]) => (items?.length ?? 0) > 0)
    .map(([key, items]) => {
      const label = key
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      return `${label}:\n${(items ?? []).map((item) => `- ${item}`).join("\n")}`;
    })
    .join("\n\n");

  return saveSiteVisitQuickNotes(requestId, sections);
}

export type CreateSiteVisitPhotoUploadResult =
  | { success: true; photoId: string; path: string }
  | ActionError;

export async function registerSiteVisitPhotoUpload(
  requestId: string,
  meta: { mimeType: string; byteSize: number }
): Promise<CreateSiteVisitPhotoUploadResult> {
  const { supabase, profileId, request } = await requireProfileAndRequest(requestId);
  if (!profileId || !request) {
    return { success: false, error: "Quote request not found." };
  }

  const { count } = await supabase
    .from("quote_request_site_visit_photos")
    .select("id", { count: "exact", head: true })
    .eq("quote_request_id", requestId);

  const countCheck = validateSiteVisitPhotoCount(count ?? 0);
  if (!countCheck.ok) {
    return { success: false, error: countCheck.error };
  }

  const metaCheck = validateSiteVisitPhotoMeta(meta);
  if (!metaCheck.ok) {
    return { success: false, error: metaCheck.error };
  }

  const photoId = generateUUID();
  const ext = extFromSiteVisitPhotoMime(metaCheck.mime);
  const path = buildSiteVisitPhotoPath(profileId, requestId, photoId, ext);

  return { success: true, photoId, path };
}

export type ConfirmSiteVisitPhotoResult =
  | { success: true; photo: SiteVisitNotesRecord["photos"][number] }
  | ActionError;

export async function confirmSiteVisitPhotoUpload(
  requestId: string,
  photoId: string,
  filePath: string,
  meta: { mimeType: string; byteSize: number }
): Promise<ConfirmSiteVisitPhotoResult> {
  const { supabase, profileId, request } = await requireProfileAndRequest(requestId);
  if (!profileId || !request) {
    return { success: false, error: "Quote request not found." };
  }

  if (!isValidSiteVisitPhotoPath(filePath, profileId, requestId)) {
    return { success: false, error: "Invalid photo path." };
  }

  const metaCheck = validateSiteVisitPhotoMeta(meta);
  if (!metaCheck.ok) {
    return { success: false, error: metaCheck.error };
  }

  const { count } = await supabase
    .from("quote_request_site_visit_photos")
    .select("id", { count: "exact", head: true })
    .eq("quote_request_id", requestId);

  const countCheck = validateSiteVisitPhotoCount(count ?? 0);
  if (!countCheck.ok) {
    return { success: false, error: countCheck.error };
  }

  const { data: inserted, error } = await supabase
    .from("quote_request_site_visit_photos")
    .insert({
      id: photoId,
      quote_request_id: requestId,
      contractor_id: profileId,
      file_path: filePath,
      display_order: count ?? 0,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    console.error("[confirmSiteVisitPhotoUpload]", error);
    return { success: false, error: "Could not save photo." };
  }

  const { data: signed } = await supabase.storage
    .from(QUOTE_REQUEST_STORAGE_BUCKET)
    .createSignedUrl(filePath, 3600);

  revalidatePath(`/quote-requests/${requestId}`);
  return {
    success: true,
    photo: mapSiteVisitPhotoRow(inserted, signed?.signedUrl ?? null),
  };
}

export type DeleteSiteVisitPhotoResult = { success: true } | ActionError;

export async function deleteSiteVisitPhoto(
  requestId: string,
  photoId: string
): Promise<DeleteSiteVisitPhotoResult> {
  const { supabase, profileId, request } = await requireProfileAndRequest(requestId);
  if (!profileId || !request) {
    return { success: false, error: "Quote request not found." };
  }

  const { data: photo } = await supabase
    .from("quote_request_site_visit_photos")
    .select("file_path")
    .eq("id", photoId)
    .eq("quote_request_id", requestId)
    .eq("contractor_id", profileId)
    .maybeSingle();

  if (!photo) {
    return { success: false, error: "Photo not found." };
  }

  const { error } = await supabase
    .from("quote_request_site_visit_photos")
    .delete()
    .eq("id", photoId)
    .eq("contractor_id", profileId);

  if (error) {
    console.error("[deleteSiteVisitPhoto]", error);
    return { success: false, error: "Could not delete photo." };
  }

  await supabase.storage.from(QUOTE_REQUEST_STORAGE_BUCKET).remove([photo.file_path]);
  revalidatePath(`/quote-requests/${requestId}`);
  return { success: true };
}

export type SaveBrowserSpeechNoteResult =
  | { success: true; transcription: string; voiceNoteId: string }
  | ActionError;

export async function saveBrowserSpeechNote(
  requestId: string,
  transcription: string
): Promise<SaveBrowserSpeechNoteResult> {
  const { supabase, profileId, request } = await requireProfileAndRequest(requestId);
  if (!profileId || !request) {
    return { success: false, error: "Quote request not found." };
  }

  const trimmed = transcription.trim();
  if (!trimmed) {
    return { success: false, error: "No speech captured." };
  }

  const voiceId = generateUUID();
  const { data: inserted, error } = await supabase
    .from("quote_request_site_visit_voice_notes")
    .insert({
      id: voiceId,
      quote_request_id: requestId,
      contractor_id: profileId,
      audio_file_path: "",
      mime_type: "text/plain",
      transcription: trimmed,
      source: "browser_speech",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[saveBrowserSpeechNote]", error);
    return { success: false, error: "Could not save dictation." };
  }

  revalidatePath(`/quote-requests/${requestId}`);
  return { success: true, transcription: trimmed, voiceNoteId: inserted.id };
}

export type RegisterVoiceUploadResult =
  | { success: true; voiceId: string; path: string }
  | ActionError;

export async function registerSiteVisitVoiceUpload(
  requestId: string,
  meta: { mimeType: string; byteSize: number }
): Promise<RegisterVoiceUploadResult> {
  const { profileId, request } = await requireProfileAndRequest(requestId);
  if (!profileId || !request) {
    return { success: false, error: "Quote request not found." };
  }

  const metaCheck = validateSiteVisitAudioMeta(meta);
  if (!metaCheck.ok) {
    return { success: false, error: metaCheck.error };
  }

  const voiceId = generateUUID();
  const ext = extFromSiteVisitAudioMime(metaCheck.mime);
  const path = buildSiteVisitVoicePath(profileId, requestId, voiceId, ext);

  return { success: true, voiceId, path };
}

export type TranscribeVoiceUploadResult =
  | { success: true; transcription: string; voiceNoteId: string }
  | ActionError;

export async function transcribeSiteVisitVoiceUpload(
  requestId: string,
  voiceId: string,
  filePath: string,
  meta: { mimeType: string; byteSize: number; durationSeconds?: number }
): Promise<TranscribeVoiceUploadResult> {
  const { supabase, profileId, request } = await requireProfileAndRequest(requestId);
  if (!profileId || !request) {
    return { success: false, error: "Quote request not found." };
  }

  if (!isValidSiteVisitVoicePath(filePath, profileId, requestId)) {
    return { success: false, error: "Invalid audio path." };
  }

  const metaCheck = validateSiteVisitAudioMeta(meta);
  if (!metaCheck.ok) {
    return { success: false, error: metaCheck.error };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { success: false, error: "Transcription is unavailable right now." };
  }

  const { data: audioBlob, error: downloadError } = await admin.storage
    .from(QUOTE_REQUEST_STORAGE_BUCKET)
    .download(filePath);

  if (downloadError || !audioBlob) {
    console.error("[transcribeSiteVisitVoiceUpload] download", downloadError);
    return { success: false, error: "Could not read audio for transcription." };
  }

  const audioBytes = await audioBlob.arrayBuffer();
  const ext = extFromSiteVisitAudioMime(metaCheck.mime);
  const transcription =
    (await transcribeAudioWithWhisper(audioBytes, metaCheck.mime, `voice.${ext}`)) ?? "";

  if (!transcription) {
    return {
      success: false,
      error: "Could not transcribe audio. Check your connection or try again.",
    };
  }

  const { data: inserted, error } = await supabase
    .from("quote_request_site_visit_voice_notes")
    .insert({
      id: voiceId,
      quote_request_id: requestId,
      contractor_id: profileId,
      audio_file_path: filePath,
      mime_type: metaCheck.mime,
      duration_seconds: meta.durationSeconds ?? null,
      transcription,
      source: "audio_upload",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[transcribeSiteVisitVoiceUpload] insert", error);
    return { success: false, error: "Could not save transcription." };
  }

  revalidatePath(`/quote-requests/${requestId}`);
  return { success: true, transcription, voiceNoteId: inserted.id };
}
