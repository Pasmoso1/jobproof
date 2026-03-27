"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createJobUpdate,
  type CreateJobUpdateResult,
} from "../../../../actions";
import { generateUUID } from "@/lib/utils/uuid";

const CATEGORIES = [
  { value: "before", label: "Before" },
  { value: "progress", label: "Progress" },
  { value: "materials", label: "Materials" },
  { value: "issue", label: "Issue" },
  { value: "completion", label: "Completion" },
  { value: "other", label: "Other" },
] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

/**
 * Android Chrome often hands back `File` objects tied to the `<input>`; clearing the input
 * (even in a microtask) can invalidate those references so `setState` holds unusable blobs.
 * Copying into a new `File` from `arrayBuffer()` keeps preview + upload stable.
 */
async function cloneCameraFilesForStaging(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try {
      const buf = await f.arrayBuffer();
      const mime =
        f.type && f.type.trim() && f.type !== "application/octet-stream"
          ? f.type
          : "image/jpeg";
      const name =
        f.name?.trim() || `capture-${Date.now()}-${i}.jpg`;
      out.push(
        new File([buf], name, {
          type: mime,
          lastModified: f.lastModified || Date.now(),
        })
      );
    } catch {
      out.push(f);
    }
  }
  return out;
}

/** Extension → MIME types allowed by `job-attachments` bucket (see supabase migrations). */
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * Mobile camera captures often omit `file.type` or use HEIC. Storage bucket enforces MIME allow-list;
 * sending octet-stream fails. Infer a safe type from extension and camera vs library source.
 */
function resolveJobAttachmentUploadMeta(
  file: File,
  source: FileSource,
  index: number
): {
  pathExtension: string;
  displayFileName: string;
  mimeType: string;
  fileType: "photo" | "video" | "document";
} {
  const rawType = (file.type || "").trim().toLowerCase();
  const name = (file.name || "").trim();
  const extLower = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

  let mime = rawType;
  if (!mime || mime === "application/octet-stream") {
    if (extLower && EXT_TO_MIME[extLower]) {
      mime = EXT_TO_MIME[extLower];
    } else if (source === "camera") {
      mime = "image/jpeg";
    }
  }

  let ext = extLower;
  if (!ext || ext === "bin") {
    if (mime.startsWith("image/")) {
      const sub = mime.split("/")[1] || "jpeg";
      ext = sub === "jpeg" ? "jpg" : sub;
    } else if (mime === "application/pdf") {
      ext = "pdf";
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      ext = "docx";
    } else if (mime === "application/msword") {
      ext = "doc";
    } else {
      ext = "bin";
    }
  }

  const displayFileName =
    name || `photo-${index + 1}.${ext === "jpeg" ? "jpg" : ext}`;

  const fileType: "photo" | "video" | "document" = mime.startsWith("image/")
    ? "photo"
    : mime.startsWith("video/")
      ? "video"
      : "document";

  return { pathExtension: ext, displayFileName, mimeType: mime, fileType };
}

type FileSource = "camera" | "library";

type StagedFile = {
  /** Stable key for list reconciliation (mobile captures often share name/size/lastModified). */
  id: string;
  file: File;
  source: FileSource;
};

type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
};

function isCreateJobUpdateSuccess(r: unknown): r is { success: true } {
  if (r == null || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  if ("error" in o && o.error != null && String(o.error).trim().length > 0) {
    return false;
  }
  return o.success === true;
}

export function AddUpdateForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<
    "before" | "progress" | "materials" | "issue" | "completion" | "other"
  >("progress");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  /** User chose Skip on the location prompt for this draft (no further prompts until camera files removed). */
  const [locationAttachDeclined, setLocationAttachDeclined] = useState(false);
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    const urls = staged.map((s, i) => {
      const f = s.file;
      const meta = resolveJobAttachmentUploadMeta(f, s.source, i);
      return meta.fileType === "photo" ? URL.createObjectURL(f) : "";
    });
    setImagePreviewUrls(urls);
    return () => {
      urls.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [staged]);

  /** Camera path is image-only; many mobile browsers omit `file.type` on captures. */
  const hasCameraPhotos = staged.some((s) => s.source === "camera");

  useEffect(() => {
    if (!staged.some((s) => s.source === "camera")) {
      setDeviceLocation(null);
      setLocationAttachDeclined(false);
      setShowLocationPrompt(false);
      setLocationError(null);
    }
  }, [staged]);

  function mergeFiles(selected: File[], source: FileSource) {
    const valid: File[] = [];
    for (const f of selected) {
      if (f.size > MAX_FILE_SIZE) {
        setError(`File "${f.name}" exceeds 10MB limit`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length === 0) {
      /*
        iOS/WebKit often fires an extra change event with an empty FileList around camera capture.
        Clearing the camera input here can cancel the real selection before it is staged.
        Only reset the library picker on empty; leave the camera input alone for source === "camera".
      */
      if (source === "library" && fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setStaged((prev) => {
      const appended = valid.map((file) => ({
        id: generateUUID(),
        file,
        source,
      }));
      const next = [...prev, ...appended].slice(0, MAX_FILES);
      return next;
    });
    setError(null);
    setSuccess(null);

    /*
      Defer clearing file inputs until after the current task: synchronous .value = ""
      in the same turn as change/onChange can invalidate the captured File on mobile WebKit
      before React commits state, so the preview/list never appears.
    */
    queueMicrotask(() => {
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    });

    if (
      source === "camera" &&
      valid.length > 0 &&
      !deviceLocation &&
      !locationAttachDeclined
    ) {
      setShowLocationPrompt(true);
      setLocationError(null);
    }
  }

  function handleLibraryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    mergeFiles(selected, "library");
  }

  function handleCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.currentTarget.files;
    const len = list?.length ?? 0;
    const selected = len > 0 && list ? Array.from(list) : [];

    if (selected.length === 0) {
      mergeFiles([], "camera");
      return;
    }

    void (async () => {
      const cloned = await cloneCameraFilesForStaging(selected);
      mergeFiles(cloned, "camera");
    })();
  }

  function removeFile(index: number) {
    setStaged((prev) => prev.filter((_, i) => i !== index));
    setSuccess(null);
  }

  function requestDeviceLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError(
        "Location isn’t available in this browser. You can still save your update without it."
      );
      return;
    }
    setLocationError(null);
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationLoading(false);
        setDeviceLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters:
            pos.coords.accuracy != null && Number.isFinite(pos.coords.accuracy)
              ? pos.coords.accuracy
              : null,
          capturedAt: new Date().toISOString(),
        });
        setShowLocationPrompt(false);
      },
      (err: GeolocationPositionError) => {
        setLocationLoading(false);
        const msg =
          err.code === 1
            ? "Location permission was denied. You can try again or skip."
            : err.code === 2
              ? "Couldn’t read your position. Try again or skip."
              : "Couldn’t get your location in time. Try again or skip.";
        setLocationError(msg);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }
    );
  }

  function skipLocationPrompt() {
    setLocationAttachDeclined(true);
    setShowLocationPrompt(false);
    setLocationError(null);
    setLocationLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    setUploadProgress(null);

    try {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    const formData = new FormData();
    formData.set("category", category);
    formData.set("title", title.trim());
    formData.set("note", note.trim() || "");
    formData.set("date", date);

    const includeLocation = Boolean(deviceLocation) && hasCameraPhotos;

    formData.set("location_attach_camera_session", includeLocation ? "true" : "false");
    if (includeLocation && deviceLocation) {
      formData.set("location_source", "device_current");
      formData.set("location_latitude", String(deviceLocation.latitude));
      formData.set("location_longitude", String(deviceLocation.longitude));
      if (deviceLocation.accuracyMeters != null) {
        formData.set("location_accuracy_meters", String(deviceLocation.accuracyMeters));
      }
      formData.set("location_captured_at", deviceLocation.capturedAt);
    }

    const filePaths: {
      storagePath: string;
      fileName: string;
      sizeBytes: number;
      mimeType?: string;
      fileType?: string;
    }[] = [];
    const supabase = createClient();

    if (staged.length > 0) {
      setUploadProgress("Uploading files...");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not authenticated");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        setError("Profile not found");
        return;
      }

      for (let i = 0; i < staged.length; i++) {
        const { file, source } = staged[i];
        const meta = resolveJobAttachmentUploadMeta(file, source, i);
        const path = `${profile.id}/${jobId}/${generateUUID()}.${meta.pathExtension}`;

        const { error: uploadError } = await supabase.storage
          .from("job-attachments")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: meta.mimeType,
          });

        if (uploadError) {
          setError(
            `Failed to upload ${meta.displayFileName}: ${uploadError.message}`
          );
          return;
        }

        filePaths.push({
          storagePath: path,
          fileName: meta.displayFileName,
          sizeBytes: file.size,
          mimeType: meta.mimeType,
          fileType: meta.fileType,
        });
      }
      setUploadProgress(null);
    }

    let result: CreateJobUpdateResult | undefined;
    try {
      result = await createJobUpdate(jobId, formData, filePaths);
    } catch (err) {
      console.error("[AddUpdateForm] createJobUpdate threw", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Could not save update. Please try again.";
      setError(
        /NEXT_REDIRECT|redirect/i.test(msg)
          ? "Could not save: session may have expired. Sign in again, then retry."
          : msg
      );
      return;
    }

    if (result && typeof result === "object" && "error" in result && result.error) {
      setError(result.error);
      return;
    }

    if (!isCreateJobUpdateSuccess(result)) {
      setError(
        `Save did not complete. The server did not return success. Got: ${JSON.stringify(result)}`
      );
      return;
    }

    setTitle("");
    setNote("");
    setDate(new Date().toISOString().slice(0, 10));
    setStaged([]);
    setDeviceLocation(null);
    setLocationAttachDeclined(false);
    setShowLocationPrompt(false);
    setSuccess("Update saved. Add another below, or go back to the job when you’re done.");
    router.refresh();
    } catch (unexpected) {
      console.error("[AddUpdateForm] save unexpected error", unexpected);
      setError(
        unexpected instanceof Error
          ? unexpected.message
          : "Something went wrong while saving. Please try again."
      );
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            {success}
          </div>
        )}

        {error && (
          <div
            className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        {uploadProgress && (
          <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {uploadProgress}
          </div>
        )}

        {deviceLocation && hasCameraPhotos && (
          <div className="rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-950">
            <p className="font-medium">Current device location attached to this photo set</p>
            <p className="mt-1 text-xs text-blue-900/80">
              Saved with this update when you submit. This is the device position when you chose
              &quot;Add location&quot;, not a guarantee the photos were taken at that spot.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-zinc-700">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-zinc-700">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Initial inspection photos"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
          />
        </div>

        <div>
          <label htmlFor="note" className="block text-sm font-medium text-zinc-700">
            Note
          </label>
          <textarea
            id="note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add details about this update..."
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
          />
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-zinc-700">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Photos & attachments</label>
          <p className="mt-0.5 text-xs text-zinc-500">
            Up to {MAX_FILES} files, 10MB each. Use <strong>Take photo</strong> for in-app camera
            (optional location prompt). Use <strong>Choose files</strong> for uploads from your
            device — those are not geo-tagged by JobProof.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleLibraryChange}
              className="block text-sm text-zinc-500 file:mr-4 file:rounded-lg file:border-0 file:bg-[#2436BB] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:hover:bg-[#1c2a96]"
            />
            {/*
              Android Chrome: label + htmlFor onto an sr-only/clipped file input can open the
              camera UI but never dispatch change after capture. Put the input on top of the
              visible control (opacity-0) so the native picker is tied to a real hit target.
            */}
            <div className="group relative inline-flex shrink-0">
              <span
                className="pointer-events-none inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 group-hover:bg-zinc-50"
                aria-hidden
              >
                Take photo
              </span>
              <input
                ref={cameraInputRef}
                id={`add-update-camera-${jobId}`}
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="Take photo"
                className="absolute inset-0 z-10 h-full w-full min-h-[44px] min-w-[8rem] cursor-pointer opacity-0"
                onChange={handleCameraChange}
              />
            </div>
          </div>
          {staged.length > 0 && (
            <ul className="mt-3 space-y-3">
              {staged.map((s, i) => {
                const rowMeta = resolveJobAttachmentUploadMeta(s.file, s.source, i);
                return (
                <li
                  key={s.id}
                  className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                >
                  {imagePreviewUrls[i] ? (
                    <img
                      src={imagePreviewUrls[i]}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-zinc-200 text-xs text-zinc-600">
                      File
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {rowMeta.displayFileName}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {(s.file.size / 1024).toFixed(1)} KB
                      {s.source === "camera" && (
                        <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-zinc-700">
                          Camera
                        </span>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="mt-1 text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
              })}
            </ul>
          )}
        </div>

        <div className="flex gap-3 border-t border-zinc-200 pt-6">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#2436BB] px-6 py-3 font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Saving…" : "Save update"}
          </button>
          <Link
            href={`/jobs/${jobId}`}
            className="rounded-lg border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
          >
            Back to job
          </Link>
        </div>
      </form>

      {showLocationPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="loc-prompt-title"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h2 id="loc-prompt-title" className="text-lg font-semibold text-zinc-900">
              Attach your current location to this photo set?
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              You can attach your current location to this update&apos;s camera photos. This is
              optional.
            </p>
            {locationError && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {locationError}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={skipLocationPrompt}
                disabled={locationLoading}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={requestDeviceLocation}
                disabled={locationLoading}
                className="rounded-lg bg-[#2436BB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-70"
              >
                {locationLoading ? "Getting location…" : "Add location"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
