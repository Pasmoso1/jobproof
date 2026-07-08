"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  confirmSiteVisitPhotoUpload,
  deleteSiteVisitPhoto,
  previewOrganizeSiteVisitNotes,
  registerSiteVisitPhotoUpload,
  registerSiteVisitVoiceUpload,
  replaceQuickNotesFromOrganized,
  saveOrganizedSiteVisitNotes,
  saveSiteVisitQuickNotes,
  transcribeSiteVisitVoiceUpload,
} from "@/app/(app)/quote-requests/[requestId]/site-visit-notes-actions";
import { QUOTE_REQUEST_STORAGE_BUCKET } from "@/lib/quote-requests/constants";
import {
  nonEmptyOrganizedSections,
  organizedNotesHasContent,
  type OrganizedSiteVisitNotes,
  type SiteVisitNotesRecord,
  type SiteVisitPhoto,
} from "@/lib/quote-requests/site-visit-notes/types";

import {
  getSpeechRecognitionCtor,
  isLiveDictationFallbackError,
  isLiveDictationSupported,
  isMediaRecorderSupported,
  LIVE_DICTATION_UNAVAILABLE_MESSAGE,
  MIC_PERMISSION_DENIED_MESSAGE,
  pickAudioRecorderMimeType,
  RECORDING_FAILED_MESSAGE,
  formatRecordingTimer,
  TRANSCRIPTION_FAILED_MESSAGE,
  VOICE_NOTE_SUCCESS_MESSAGE,
  type SpeechRecognitionInstance,
  type SpeechRecognitionResultEvent,
} from "@/lib/quote-requests/site-visit-notes/speech-support";

type RecordingWorkflowState = "idle" | "recording" | "processing" | "completed";

function scrollQuickNotesIntoView(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
}

function CollapsibleSection({
  title,
  defaultOpen,
  badge,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-zinc-100 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          {title}
          {badge ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="text-xs text-zinc-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div className="pb-4">{children}</div> : null}
    </div>
  );
}

function OrganizedNotesPreview({
  organized,
}: {
  organized: OrganizedSiteVisitNotes;
}) {
  const sections = nonEmptyOrganizedSections(organized);
  if (sections.length === 0) {
    return <p className="text-sm text-zinc-500">No sections to preview.</p>;
  }

  return (
    <div className="max-h-80 space-y-4 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      {sections.map((section) => (
        <div key={section.key}>
          <h4 className="text-sm font-semibold text-zinc-900">{section.label}</h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {section.items.map((item, index) => (
              <li key={`${section.key}-${index}`} className="text-sm text-zinc-700">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function OrganizedNotesDisplay({
  organized,
}: {
  organized: OrganizedSiteVisitNotes;
}) {
  const sections = nonEmptyOrganizedSections(organized);
  if (sections.length === 0) {
    return <p className="text-sm text-zinc-500">No organized notes yet.</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.key} className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2.5">
          <h4 className="text-sm font-semibold text-zinc-900">{section.label}</h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {section.items.map((item, index) => (
              <li key={`${section.key}-${index}`} className="text-sm text-zinc-700">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function QuoteRequestSiteVisitNotes({
  requestId,
  initialRecord,
}: {
  requestId: string;
  initialRecord: SiteVisitNotesRecord;
}) {
  const [quickNotes, setQuickNotes] = useState(initialRecord.quickNotes);
  const [organizedNotes, setOrganizedNotes] = useState(initialRecord.organizedNotes);
  const [photos, setPhotos] = useState(initialRecord.photos);
  const [voiceNotes] = useState(initialRecord.voiceNotes);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [voiceInfo, setVoiceInfo] = useState<string | null>(null);
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null);
  const [voiceSuccess, setVoiceSuccess] = useState<string | null>(null);
  const [previewOrganized, setPreviewOrganized] = useState<OrganizedSiteVisitNotes | null>(null);
  const [isDictating, setIsDictating] = useState(false);
  const [recordingWorkflow, setRecordingWorkflow] = useState<RecordingWorkflowState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveDictationSupported, setLiveDictationSupported] = useState(
    () => typeof window !== "undefined" && isLiveDictationSupported()
  );
  const [mediaRecorderSupported] = useState(
    () => typeof window !== "undefined" && isMediaRecorderSupported()
  );
  const [pending, startTransition] = useTransition();
  const [photoUploading, setPhotoUploading] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickNotesTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const dictationHadResultsRef = useRef(false);
  const dictationStartedRef = useRef(false);
  const dictationFailureHandledRef = useRef(false);

  useEffect(() => {
    if (recordingWorkflow !== "recording") return;
    const interval = setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [recordingWorkflow]);

  const persistQuickNotes = useCallback(
    (value: string) => {
      setSaveState("saving");
      startTransition(async () => {
        const result = await saveSiteVisitQuickNotes(requestId, value);
        if (result.success) {
          setSaveState("saved");
        } else {
          setSaveState("error");
          setError(result.error);
        }
      });
    },
    [requestId]
  );

  useEffect(() => {
    if (quickNotes === initialRecord.quickNotes) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistQuickNotes(quickNotes);
    }, 1200);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [quickNotes, initialRecord.quickNotes, persistQuickNotes]);

  function appendToQuickNotes(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuickNotes((prev) => {
      const base = prev.trim();
      return base ? `${base}\n\n${trimmed}` : trimmed;
    });
  }

  function handleOrganize() {
    setError(null);
    startTransition(async () => {
      const result = await previewOrganizeSiteVisitNotes(requestId);
      if (result.success) {
        setPreviewOrganized(result.organized);
      } else {
        setError(result.error);
      }
    });
  }

  function handleSaveOrganized() {
    if (!previewOrganized) return;
    setError(null);
    startTransition(async () => {
      const result = await saveOrganizedSiteVisitNotes(requestId, previewOrganized);
      if (result.success) {
        setOrganizedNotes(result.organized);
        setPreviewOrganized(null);
      } else {
        setError(result.error);
      }
    });
  }

  function handleReplaceQuickNotes() {
    if (!previewOrganized) return;
    setError(null);
    startTransition(async () => {
      const saveOrganized = await saveOrganizedSiteVisitNotes(requestId, previewOrganized);
      if (!saveOrganized.success) {
        setError(saveOrganized.error);
        return;
      }
      const replace = await replaceQuickNotesFromOrganized(requestId, previewOrganized);
      if (replace.success) {
        setOrganizedNotes(previewOrganized);
        setQuickNotes(replace.quickNotes);
        setPreviewOrganized(null);
      } else {
        setError(replace.error);
      }
    });
  }

  async function uploadSiteVisitPhoto(file: File): Promise<boolean> {
    const supabase = createClient();
    const mimeType = file.type || "image/jpeg";

    const register = await registerSiteVisitPhotoUpload(requestId, {
      mimeType,
      byteSize: file.size,
    });
    if (!register.success) {
      setError(register.error);
      return false;
    }

    const { error: uploadError } = await supabase.storage
      .from(QUOTE_REQUEST_STORAGE_BUCKET)
      .upload(register.path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: mimeType,
      });

    if (uploadError) {
      setError(`Photo upload failed: ${uploadError.message}`);
      return false;
    }

    const confirm = await confirmSiteVisitPhotoUpload(
      requestId,
      register.photoId,
      register.path,
      { mimeType, byteSize: file.size }
    );

    if (confirm.success) {
      setPhotos((prev) => [...prev, confirm.photo]);
      return true;
    }

    setError(confirm.error);
    return false;
  }

  async function handleCameraPhotoSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    setPhotoUploading(true);
    try {
      await uploadSiteVisitPhoto(file);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handlePhotoSelected(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError(null);
    setPhotoUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const ok = await uploadSiteVisitPhoto(file);
        if (!ok) return;
      }
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleDeletePhoto(photo: SiteVisitPhoto) {
    setError(null);
    startTransition(async () => {
      const result = await deleteSiteVisitPhoto(requestId, photo.id);
      if (result.success) {
        setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      } else {
        setError(result.error);
      }
    });
  }

  function stopDictation() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsDictating(false);
  }

  function handleLiveDictationFailure(errorCode: string | undefined, hadResults: boolean) {
    if (dictationFailureHandledRef.current) return;
    dictationFailureHandledRef.current = true;

    stopDictation();
    dictationStartedRef.current = false;

    if (errorCode === "aborted") return;

    if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
      setVoiceInfo(MIC_PERMISSION_DENIED_MESSAGE);
      return;
    }

    if (isLiveDictationFallbackError(errorCode) || !hadResults) {
      setLiveDictationSupported(false);
      setVoiceInfo(LIVE_DICTATION_UNAVAILABLE_MESSAGE);
      return;
    }

    if (hadResults) {
      setVoiceInfo("Live dictation ended. You can keep typing or record another audio note.");
    }
  }

  function startBrowserDictation() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceInfo(LIVE_DICTATION_UNAVAILABLE_MESSAGE);
      return;
    }

    setError(null);
    setVoiceInfo(null);
    dictationHadResultsRef.current = false;
    dictationStartedRef.current = false;
    dictationFailureHandledRef.current = false;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let sessionText = "";

    recognition.onstart = () => {
      dictationStartedRef.current = true;
    };

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      dictationHadResultsRef.current = true;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) {
          sessionText += `${transcript} `;
        }
      }
      if (sessionText.trim()) {
        appendToQuickNotes(sessionText.trim());
        sessionText = "";
      }
    };

    recognition.onerror = (event) => {
      handleLiveDictationFailure(event.error, dictationHadResultsRef.current);
    };

    recognition.onend = () => {
      if (sessionText.trim()) {
        appendToQuickNotes(sessionText.trim());
        dictationHadResultsRef.current = true;
      }
      if (
        !dictationFailureHandledRef.current &&
        dictationStartedRef.current &&
        !dictationHadResultsRef.current
      ) {
        handleLiveDictationFailure("network", false);
      }
      setIsDictating(false);
      recognitionRef.current = null;
      dictationStartedRef.current = false;
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setIsDictating(true);
    } catch {
      handleLiveDictationFailure("service-not-allowed", false);
    }
  }

  function handleRecordAudioClick() {
    if (recordingWorkflow === "recording") {
      stopAudioRecording();
      return;
    }
    if (recordingWorkflow === "processing") return;
    void startAudioRecording();
  }

  function resetRecordingFeedback() {
    setVoiceSuccess(null);
    setVoiceWarning(null);
    setVoiceInfo(null);
  }

  function handleLiveDictationClick() {
    if (isDictating) {
      stopDictation();
      return;
    }
    startBrowserDictation();
  }

  async function startAudioRecording() {
    if (!isMediaRecorderSupported()) {
      setVoiceInfo(LIVE_DICTATION_UNAVAILABLE_MESSAGE);
      return;
    }

    setError(null);
    resetRecordingFeedback();
    setRecordingSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = pickAudioRecorderMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setRecordingWorkflow("idle");
        setVoiceWarning(RECORDING_FAILED_MESSAGE);
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        void processRecordedAudio(mimeType);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingWorkflow("recording");
    } catch (err) {
      setRecordingWorkflow("idle");
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setVoiceInfo(MIC_PERMISSION_DENIED_MESSAGE);
      } else {
        setVoiceWarning(RECORDING_FAILED_MESSAGE);
      }
    }
  }

  function stopAudioRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      setRecordingWorkflow("processing");
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
  }

  async function processRecordedAudio(mimeType: string) {
    const blob = new Blob(audioChunksRef.current, { type: mimeType });
    if (blob.size === 0) {
      setRecordingWorkflow("idle");
      setVoiceWarning(RECORDING_FAILED_MESSAGE);
      return;
    }

    setError(null);
    setRecordingWorkflow("processing");
    startTransition(async () => {
      let uploadSucceeded = false;
      try {
        const register = await registerSiteVisitVoiceUpload(requestId, {
          mimeType,
          byteSize: blob.size,
        });
        if (!register.success) {
          setRecordingWorkflow("idle");
          setVoiceWarning(RECORDING_FAILED_MESSAGE);
          return;
        }

        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from(QUOTE_REQUEST_STORAGE_BUCKET)
          .upload(register.path, blob, {
            cacheControl: "3600",
            upsert: false,
            contentType: mimeType,
          });

        if (uploadError) {
          setRecordingWorkflow("idle");
          setVoiceWarning(RECORDING_FAILED_MESSAGE);
          return;
        }

        uploadSucceeded = true;

        const result = await transcribeSiteVisitVoiceUpload(
          requestId,
          register.voiceId,
          register.path,
          { mimeType, byteSize: blob.size, durationSeconds: recordingSeconds }
        );

        if (result.success) {
          appendToQuickNotes(result.transcription);
          setVoiceSuccess(VOICE_NOTE_SUCCESS_MESSAGE);
          setRecordingWorkflow("completed");
          window.setTimeout(() => {
            scrollQuickNotesIntoView(quickNotesTextareaRef.current);
          }, 100);
        } else {
          setRecordingWorkflow("idle");
          setVoiceWarning(
            uploadSucceeded
              ? TRANSCRIPTION_FAILED_MESSAGE
              : RECORDING_FAILED_MESSAGE
          );
        }
      } catch {
        setRecordingWorkflow("idle");
        setVoiceWarning(
          uploadSucceeded ? TRANSCRIPTION_FAILED_MESSAGE : RECORDING_FAILED_MESSAGE
        );
      }
    });
  }

  async function handleAudioFileSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    setError(null);
    resetRecordingFeedback();
    setRecordingWorkflow("processing");
    startTransition(async () => {
      let uploadSucceeded = false;
      try {
        const register = await registerSiteVisitVoiceUpload(requestId, {
          mimeType: file.type || "audio/webm",
          byteSize: file.size,
        });
        if (!register.success) {
          setRecordingWorkflow("idle");
          setVoiceWarning(RECORDING_FAILED_MESSAGE);
          return;
        }

        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from(QUOTE_REQUEST_STORAGE_BUCKET)
          .upload(register.path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "audio/webm",
          });

        if (uploadError) {
          setRecordingWorkflow("idle");
          setVoiceWarning(RECORDING_FAILED_MESSAGE);
          return;
        }

        uploadSucceeded = true;

        const result = await transcribeSiteVisitVoiceUpload(
          requestId,
          register.voiceId,
          register.path,
          { mimeType: file.type || "audio/webm", byteSize: file.size }
        );

        if (result.success) {
          appendToQuickNotes(result.transcription);
          setVoiceSuccess(VOICE_NOTE_SUCCESS_MESSAGE);
          setRecordingWorkflow("completed");
          window.setTimeout(() => {
            scrollQuickNotesIntoView(quickNotesTextareaRef.current);
          }, 100);
        } else {
          setRecordingWorkflow("idle");
          setVoiceWarning(
            uploadSucceeded
              ? TRANSCRIPTION_FAILED_MESSAGE
              : RECORDING_FAILED_MESSAGE
          );
        }
      } catch {
        setRecordingWorkflow("idle");
        setVoiceWarning(
          uploadSucceeded ? TRANSCRIPTION_FAILED_MESSAGE : RECORDING_FAILED_MESSAGE
        );
      }
    });
  }

  const isRecording = recordingWorkflow === "recording";
  const isTranscribing = recordingWorkflow === "processing";
  const voiceBusy = pending || isTranscribing;
  const organizedCount = organizedNotes ? nonEmptyOrganizedSections(organizedNotes).length : 0;
  const showLiveDictationUnavailable =
    !liveDictationSupported && mediaRecorderSupported;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Site Visit Notes</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Private workspace for your site visit — not visible to the customer.
        </p>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-2">
        <CollapsibleSection title="Quick Notes" defaultOpen>
          <textarea
            ref={quickNotesTextareaRef}
            value={quickNotes}
            onChange={(e) => {
              setSaveState("idle");
              setQuickNotes(e.target.value);
            }}
            onBlur={() => {
              if (quickNotes !== initialRecord.quickNotes) {
                persistQuickNotes(quickNotes);
              }
            }}
            rows={8}
            placeholder="Type what you observed on site — measurements, conditions, customer requests, access issues..."
            className="w-full resize-y rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                    ? "Save failed"
                    : "Auto-saves as you type"}
            </p>
            <button
              type="button"
              onClick={handleOrganize}
              disabled={pending || !quickNotes.trim()}
              className="rounded-lg bg-[#2436BB] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1e2d9a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending && previewOrganized === null ? "Organizing…" : "Organize Notes"}
            </button>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Organized Notes"
          defaultOpen={false}
          badge={organizedCount > 0 ? `${organizedCount} sections` : undefined}
        >
          {organizedNotesHasContent(organizedNotes) ? (
            <OrganizedNotesDisplay organized={organizedNotes!} />
          ) : (
            <p className="text-sm text-zinc-500">
              Use Organize Notes to group your observations into sections. Nothing is changed until you review and save.
            </p>
          )}

          {previewOrganized ? (
            <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
              <p className="text-sm font-medium text-zinc-900">Review organized notes</p>
              <OrganizedNotesPreview organized={previewOrganized} />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveOrganized}
                  disabled={pending}
                  className="rounded-lg bg-[#2436BB] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1e2d9a] disabled:opacity-50"
                >
                  Save organized notes
                </button>
                <button
                  type="button"
                  onClick={handleReplaceQuickNotes}
                  disabled={pending}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Replace Quick Notes
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOrganized(null)}
                  disabled={pending}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
                >
                  Discard
                </button>
              </div>
            </div>
          ) : null}
        </CollapsibleSection>

        <CollapsibleSection
          title="Site Visit Photos"
          defaultOpen={false}
          badge={photos.length > 0 ? `${photos.length}` : undefined}
        >
          <p className="mb-3 text-xs text-zinc-500">
            Take photos during the visit or upload existing photos. These are private and not
            visible to the customer.
          </p>
          {photos.length > 0 ? (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo) =>
                photo.signedUrl ? (
                  <div key={photo.id} className="group relative overflow-hidden rounded-lg border border-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.signedUrl}
                      alt="Site visit"
                      className="aspect-square w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(photo)}
                      className="absolute right-1 top-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white sm:opacity-0 sm:transition sm:group-hover:opacity-100"
                    >
                      Remove
                    </button>
                  </div>
                ) : null
              )}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <label
              className={`inline-flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm font-medium text-white ${
                photoUploading
                  ? "cursor-not-allowed bg-[#2436BB]/60"
                  : "bg-[#2436BB] hover:bg-[#1e2d9a]"
              }`}
            >
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={photoUploading}
                onChange={(e) => {
                  void handleCameraPhotoSelected(e.target.files);
                  e.target.value = "";
                }}
              />
              {photoUploading ? "Uploading…" : "Take photo"}
            </label>
            <label
              className={`inline-flex cursor-pointer items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 ${
                photoUploading ? "cursor-not-allowed opacity-60" : ""
              }`}
            >
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
                multiple
                className="sr-only"
                disabled={photoUploading}
                onChange={(e) => {
                  void handlePhotoSelected(e.target.files);
                  e.target.value = "";
                }}
              />
              Upload photos
            </label>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Voice Dictation"
          defaultOpen={false}
          badge={voiceNotes.length > 0 ? `${voiceNotes.length}` : undefined}
        >
          {showLiveDictationUnavailable && !voiceInfo && recordingWorkflow === "idle" ? (
            <p className="mb-3 text-sm text-zinc-600">{LIVE_DICTATION_UNAVAILABLE_MESSAGE}</p>
          ) : null}

          {voiceSuccess ? (
            <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              ✓ {voiceSuccess}
            </p>
          ) : null}

          {voiceInfo ? (
            <p className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              {voiceInfo}
            </p>
          ) : null}

          {voiceWarning ? (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {voiceWarning}
            </p>
          ) : null}

          {mediaRecorderSupported ? (
            <div className="space-y-3">
              {recordingWorkflow === "idle" && !voiceSuccess ? (
                <p className="text-sm text-zinc-600">
                  Record a voice note after your site visit. It will be transcribed into your Quick Notes.
                </p>
              ) : null}

              {isRecording ? (
                <div
                  className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5"
                  aria-live="polite"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-red-800">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                    </span>
                    Recording…
                  </span>
                  <span className="font-mono text-sm tabular-nums text-red-900">
                    {formatRecordingTimer(recordingSeconds)}
                  </span>
                </div>
              ) : null}

              {isTranscribing ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5" aria-live="polite">
                  <p className="text-sm font-medium text-zinc-800">⏳ Transcribing your notes…</p>
                  <p className="mt-0.5 text-xs text-zinc-500">This usually takes just a few seconds.</p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleRecordAudioClick}
                disabled={voiceBusy || isDictating}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  isRecording
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : isTranscribing
                      ? "cursor-not-allowed bg-zinc-200 text-zinc-500"
                      : "bg-[#2436BB] text-white hover:bg-[#1e2d9a]"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {isRecording
                  ? "🟥 Stop Recording"
                  : isTranscribing
                    ? "⏳ Processing..."
                    : recordingWorkflow === "completed"
                      ? "🎤 Record Another Note"
                      : "🎤 Start Recording"}
              </button>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {liveDictationSupported ? (
              <button
                type="button"
                onClick={handleLiveDictationClick}
                disabled={voiceBusy || isRecording}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  isDictating
                    ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {isDictating ? "Stop live dictation" : "Live dictation"}
              </button>
            ) : null}

            <label
              className={`inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 ${
                voiceBusy || isRecording || isDictating
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer"
              }`}
            >
              <input
                type="file"
                accept="audio/*"
                className="sr-only"
                disabled={voiceBusy || isRecording || isDictating}
                onChange={(e) => {
                  void handleAudioFileSelected(e.target.files);
                  e.target.value = "";
                }}
              />
              Upload audio
            </label>
          </div>

          {recordingWorkflow === "idle" && !isTranscribing && !voiceSuccess && liveDictationSupported ? (
            <p className="mt-2 text-xs text-zinc-500">
              Or use live dictation on desktop. Transcription is added to Quick Notes for you to edit.
            </p>
          ) : null}

          {voiceNotes.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {voiceNotes.slice(0, 3).map((note) => (
                <li key={note.id} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  {note.transcription.slice(0, 120)}
                  {note.transcription.length > 120 ? "…" : ""}
                  {note.signedAudioUrl ? (
                    <>
                      {" "}
                      <a
                        href={note.signedAudioUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#2436BB] hover:underline"
                      >
                        Play audio
                      </a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </CollapsibleSection>
      </div>
    </section>
  );
}
