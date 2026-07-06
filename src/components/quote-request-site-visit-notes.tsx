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

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
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
  const [previewOrganized, setPreviewOrganized] = useState<OrganizedSiteVisitNotes | null>(null);
  const [isDictating, setIsDictating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pending, startTransition] = useTransition();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const quickNotesRef = useRef(quickNotes);

  useEffect(() => {
    quickNotesRef.current = quickNotes;
  }, [quickNotes]);

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

  async function handlePhotoSelected(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError(null);
    const supabase = createClient();

    for (const file of Array.from(fileList)) {
      const register = await registerSiteVisitPhotoUpload(requestId, {
        mimeType: file.type,
        byteSize: file.size,
      });
      if (!register.success) {
        setError(register.error);
        return;
      }

      const { error: uploadError } = await supabase.storage
        .from(QUOTE_REQUEST_STORAGE_BUCKET)
        .upload(register.path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}`);
        return;
      }

      const confirm = await confirmSiteVisitPhotoUpload(
        requestId,
        register.photoId,
        register.path,
        { mimeType: file.type, byteSize: file.size }
      );

      if (confirm.success) {
        setPhotos((prev) => [...prev, confirm.photo]);
      } else {
        setError(confirm.error);
        return;
      }
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

  function startBrowserDictation() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return false;

    setError(null);
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let sessionText = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) {
          sessionText += `${transcript} `;
        } else {
          interim += transcript;
        }
      }
      if (sessionText.trim()) {
        appendToQuickNotes(sessionText.trim());
        sessionText = "";
      }
      if (interim.trim()) {
        // interim only — final chunks are appended
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        setError("Dictation stopped. You can type or record audio instead.");
      }
      stopDictation();
    };

    recognition.onend = () => {
      if (sessionText.trim()) {
        appendToQuickNotes(sessionText.trim());
      }
      setIsDictating(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsDictating(true);
    return true;
  }

  function handleDictateClick() {
    if (isRecording) {
      stopAudioRecording();
      return;
    }
    if (isDictating) {
      stopDictation();
      return;
    }
    if (startBrowserDictation()) return;
    void startAudioRecording();
  }

  async function startAudioRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Voice dictation is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        void processRecordedAudio(mimeType);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setError(null);
    } catch {
      setError("Microphone access was denied.");
    }
  }

  function stopAudioRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }

  async function processRecordedAudio(mimeType: string) {
    const blob = new Blob(audioChunksRef.current, { type: mimeType });
    if (blob.size === 0) {
      setError("No audio captured.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const register = await registerSiteVisitVoiceUpload(requestId, {
        mimeType,
        byteSize: blob.size,
      });
      if (!register.success) {
        setError(register.error);
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
        setError(`Audio upload failed: ${uploadError.message}`);
        return;
      }

      const result = await transcribeSiteVisitVoiceUpload(
        requestId,
        register.voiceId,
        register.path,
        { mimeType, byteSize: blob.size }
      );

      if (result.success) {
        appendToQuickNotes(result.transcription);
      } else {
        setError(result.error);
      }
    });
  }

  async function handleAudioFileSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    setError(null);
    startTransition(async () => {
      const register = await registerSiteVisitVoiceUpload(requestId, {
        mimeType: file.type || "audio/webm",
        byteSize: file.size,
      });
      if (!register.success) {
        setError(register.error);
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
        setError(`Audio upload failed: ${uploadError.message}`);
        return;
      }

      const result = await transcribeSiteVisitVoiceUpload(
        requestId,
        register.voiceId,
        register.path,
        { mimeType: file.type || "audio/webm", byteSize: file.size }
      );

      if (result.success) {
        appendToQuickNotes(result.transcription);
      } else {
        setError(result.error);
      }
    });
  }

  const speechAvailable = typeof window !== "undefined" && Boolean(getSpeechRecognitionCtor());
  const organizedCount = organizedNotes ? nonEmptyOrganizedSections(organizedNotes).length : 0;

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
            Separate from customer-uploaded photos. These will feed future AI features.
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
                      className="absolute right-1 top-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
                    >
                      Remove
                    </button>
                  </div>
                ) : null
              )}
            </div>
          ) : null}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50">
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
              multiple
              className="sr-only"
              onChange={(e) => {
                void handlePhotoSelected(e.target.files);
                e.target.value = "";
              }}
            />
            Upload photos
          </label>
        </CollapsibleSection>

        <CollapsibleSection
          title="Voice Dictation"
          defaultOpen={false}
          badge={voiceNotes.length > 0 ? `${voiceNotes.length}` : undefined}
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDictateClick}
              disabled={pending}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                isDictating || isRecording
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-[#2436BB] text-white hover:bg-[#1e2d9a]"
              } disabled:opacity-50`}
            >
              {isDictating || isRecording ? "Stop dictation" : "Dictate Notes"}
            </button>
            {!speechAvailable ? (
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                <input
                  type="file"
                  accept="audio/*"
                  className="sr-only"
                  onChange={(e) => {
                    void handleAudioFileSelected(e.target.files);
                    e.target.value = "";
                  }}
                />
                Upload audio
              </label>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {speechAvailable
              ? "Speech is transcribed into Quick Notes. Edit before organizing."
              : "Record or upload audio — transcription is added to Quick Notes for you to review."}
          </p>
          {isRecording ? (
            <p className="mt-2 text-sm text-red-600">Recording… tap Stop when finished.</p>
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
