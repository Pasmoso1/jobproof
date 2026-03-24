"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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

const IS_DEV = process.env.NODE_ENV === "development";

/** Bump when changing on-device camera diagnostics so testers can confirm the bundle. */
const CAMERA_DEBUG_BUILD = "v2";

type CameraHandlerPath = "custom" | "nativeTest";

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
  /** Dev-only: fully visible control to compare Android behavior vs custom Take photo. */
  const cameraNativeTestInputRef = useRef<HTMLInputElement>(null);
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
  /** Dev-only: last submit trace for on-screen debugging */
  const [devSubmitReport, setDevSubmitReport] = useState<string>("");
  /** Dev-only: visible on-phone camera / staging / save pipeline */
  const [cameraFlowDebug, setCameraFlowDebug] = useState<Record<string, unknown>>({});

  const patchCam = (updates: Record<string, unknown>) => {
    if (!IS_DEV) return;
    setCameraFlowDebug((prev) => ({ ...prev, ...updates }));
  };

  /** Stable ref + dev wiring audit: mounted, id, disabled, connected to document. */
  const setCameraInputEl = useCallback((el: HTMLInputElement | null) => {
    cameraInputRef.current = el;
    if (!IS_DEV) return;
    queueMicrotask(() => {
      setCameraFlowDebug((prev) => ({
        ...prev,
        cameraInputMounted: Boolean(el),
        cameraInputId: el?.id ?? "",
        cameraInputDisabled: Boolean(el?.disabled),
        cameraInputInDocument: Boolean(el?.isConnected),
      }));
    });
  }, []);

  const setCameraNativeTestInputEl = useCallback((el: HTMLInputElement | null) => {
    cameraNativeTestInputRef.current = el;
    if (!IS_DEV) return;
    queueMicrotask(() => {
      setCameraFlowDebug((prev) => ({
        ...prev,
        nativeCameraTestInputMounted: Boolean(el),
        nativeCameraTestInputId: el?.id ?? "",
        nativeCameraTestInDocument: Boolean(el?.isConnected),
      }));
    });
  }, []);

  useEffect(() => {
    const urls = staged.map((s, i) => {
      const f = s.file;
      const meta = resolveJobAttachmentUploadMeta(f, s.source, i);
      return meta.fileType === "photo" ? URL.createObjectURL(f) : "";
    });
    const objectUrlCount = urls.filter(Boolean).length;
    if (IS_DEV) {
      console.debug("[AddUpdateForm] preview effect", {
        stagedCount: staged.length,
        objectUrlCount,
        bySource: {
          camera: staged.filter((s) => s.source === "camera").length,
          library: staged.filter((s) => s.source === "library").length,
        },
      });
      setCameraFlowDebug((prev) => ({
        ...prev,
        previewObjectUrlCount: objectUrlCount,
        previewStagedCount: staged.length,
        lastPreviewEffectIso: new Date().toISOString(),
      }));
    }
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
    const stagedBefore = staged.length;
    if (IS_DEV) {
      console.debug("[AddUpdateForm] mergeFiles called", {
        source,
        selectedCount: selected.length,
      });
      setCameraFlowDebug((prev) => ({
        ...prev,
        mergeFilesCalls: (Number(prev.mergeFilesCalls) || 0) + 1,
        lastMergeIso: new Date().toISOString(),
        lastMergeSource: source,
        lastMergeSelectedCount: selected.length,
        lastMergeStagedBefore: stagedBefore,
      }));
    }

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
      if (IS_DEV) {
        console.debug("[AddUpdateForm] mergeFiles: empty selection, skipped staging", {
          source,
          clearedLibraryOnly: source === "library",
        });
        patchCam({
          lastMergeEmptySelection: true,
          lastMergeStagedAfterExpected: stagedBefore,
          lastMergeValidCount: 0,
        });
      }
      return;
    }

    const afterExpected = Math.min(stagedBefore + valid.length, MAX_FILES);
    if (IS_DEV) {
      patchCam({
        lastMergeEmptySelection: false,
        lastMergeValidCount: valid.length,
        lastMergeStagedAfterExpected: afterExpected,
      });
    }

    setStaged((prev) => {
      const appended = valid.map((file) => ({
        id: generateUUID(),
        file,
        source,
      }));
      const next = [...prev, ...appended].slice(0, MAX_FILES);
      if (IS_DEV) {
        console.debug("[AddUpdateForm] mergeFiles: staged updated", {
          source,
          previousCount: prev.length,
          nextCount: next.length,
        });
      }
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
      if (cameraNativeTestInputRef.current) cameraNativeTestInputRef.current.value = "";
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
    if (IS_DEV) {
      setCameraFlowDebug((prev) => ({
        ...prev,
        chooseFilesOnChangeCount: (Number(prev.chooseFilesOnChangeCount) || 0) + 1,
        lastChooseFilesOnChangeIso: new Date().toISOString(),
      }));
    }
    const selected = Array.from(e.target.files ?? []);
    mergeFiles(selected, "library");
  }

  function handleCameraChange(
    e: React.ChangeEvent<HTMLInputElement>,
    path: CameraHandlerPath
  ) {
    const input = e.currentTarget;
    const list = input.files;
    const len = list?.length ?? 0;
    const selected = len > 0 && list ? Array.from(list) : [];

    if (IS_DEV) {
      console.debug("[AddUpdateForm] camera input onChange", {
        path,
        fileListLength: len,
        files: selected.map((f) => ({
          name: f.name || "(empty name)",
          size: f.size,
          type: f.type || "(empty type)",
        })),
      });
      setCameraFlowDebug((prev) => ({
        ...prev,
        lastCameraHandlerPath: path,
        ...(path === "custom"
          ? {
              customTakePhotoOnChangeCount:
                (Number(prev.customTakePhotoOnChangeCount) || 0) + 1,
              lastCustomTakePhotoOnChangeIso: new Date().toISOString(),
            }
          : {
              nativeCameraTestOnChangeCount:
                (Number(prev.nativeCameraTestOnChangeCount) || 0) + 1,
              lastNativeCameraTestOnChangeIso: new Date().toISOString(),
            }),
        cameraOnChangeCount: (Number(prev.cameraOnChangeCount) || 0) + 1,
        lastCameraOnChangeIso: new Date().toISOString(),
        lastCameraFileListLength: len,
        lastCameraFilesSnapshot: selected.map((f) => ({
          name: f.name || "",
          size: f.size,
          type: f.type || "",
        })),
        cameraClonePhase: len === 0 ? "skip (empty list)" : "reading…",
      }));
    }

    if (selected.length === 0) {
      mergeFiles([], "camera");
      return;
    }

    void (async () => {
      if (IS_DEV) patchCam({ cameraClonePhase: "arrayBuffer() clone…" });
      const cloned = await cloneCameraFilesForStaging(selected);
      if (IS_DEV) {
        patchCam({
          cameraClonePhase: "mergeFiles(cloned)",
          clonedFileSizes: cloned.map((f) => f.size),
          clonedFileTypes: cloned.map((f) => f.type),
        });
      }
      mergeFiles(cloned, "camera");
      if (IS_DEV) patchCam({ cameraClonePhase: "done" });
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

    let devTrace = "";
    const dbg = (label: string, data?: unknown) => {
      if (!IS_DEV) return;
      const serialized =
        data !== undefined
          ? JSON.stringify(
              data,
              (_, v) => (typeof v === "bigint" ? String(v) : v),
              2
            )
          : "";
      const chunk = data !== undefined ? `${label}\n${serialized}` : label;
      devTrace += (devTrace ? "\n\n---\n\n" : "") + chunk;
      console.debug(`[AddUpdateForm] ${label}`, data ?? "");
    };

    try {
    if (!title.trim()) {
      dbg("blocked: validation", { reason: "title required" });
      if (IS_DEV) {
        patchCam({
          lastSubmitHandlerIso: new Date().toISOString(),
          submitBlocked: "title required",
        });
      }
      setError("Title is required");
      return;
    }

    if (IS_DEV) {
      setCameraFlowDebug((prev) => ({
        ...prev,
        submitHandlerRuns: (Number(prev.submitHandlerRuns) || 0) + 1,
        lastSubmitHandlerIso: new Date().toISOString(),
        submitStagedAtStart: staged.length,
        submitBlocked: null,
        createJobUpdateCalled: false,
        createJobUpdateCallIso: null,
        createJobUpdateFilePathsCount: null,
        createJobUpdateResultJson: null,
        createJobUpdateResultIso: null,
      }));
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

    {
      const cameraCount = staged.filter((s) => s.source === "camera").length;
      const libraryCount = staged.filter((s) => s.source === "library").length;
      dbg("submit start", {
        stagedTotal: staged.length,
        cameraTagged: cameraCount,
        libraryTagged: libraryCount,
        titleLen: title.trim().length,
        hasDeviceLocation: Boolean(deviceLocation),
      });
    }

    if (staged.length > 0) {
      setUploadProgress("Uploading files...");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        dbg("upload blocked: not authenticated (client session)");
        setError("Not authenticated");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        dbg("upload blocked: profile not found");
        setError("Profile not found");
        return;
      }

      for (let i = 0; i < staged.length; i++) {
        const { file, source } = staged[i];
        const meta = resolveJobAttachmentUploadMeta(file, source, i);
        dbg(`file[${i}] resolved metadata`, {
          source,
          mimeType: meta.mimeType,
          fileType: meta.fileType,
          displayFileName: meta.displayFileName,
          pathExtension: meta.pathExtension,
          sizeBytes: file.size,
          rawFileType: file.type || "(empty)",
          rawFileName: file.name || "(empty)",
        });
        const path = `${profile.id}/${jobId}/${generateUUID()}.${meta.pathExtension}`;

        const { error: uploadError } = await supabase.storage
          .from("job-attachments")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: meta.mimeType,
          });

        if (uploadError) {
          dbg(`file[${i}] storage upload FAILED`, {
            path,
            message: uploadError.message,
            source,
            contentType: meta.mimeType,
          });
          setError(
            `Failed to upload ${meta.displayFileName}: ${uploadError.message}`
          );
          return;
        }

        dbg(`file[${i}] storage upload OK`, {
          path,
          source,
          mimeType: meta.mimeType,
          fileType: meta.fileType,
        });

        filePaths.push({
          storagePath: path,
          fileName: meta.displayFileName,
          sizeBytes: file.size,
          mimeType: meta.mimeType,
          fileType: meta.fileType,
        });
      }
      setUploadProgress(null);
    } else {
      dbg("no staged files", { filePathsWillBeEmpty: true });
    }

    dbg("createJobUpdate payload (filePaths)", filePaths);
    dbg("createJobUpdate calling", { jobId, filePathsCount: filePaths.length });

    if (IS_DEV) {
      patchCam({
        createJobUpdateCallIso: new Date().toISOString(),
        createJobUpdateFilePathsCount: filePaths.length,
        createJobUpdateCalled: true,
      });
    }

    let result: CreateJobUpdateResult | undefined;
    try {
      result = await createJobUpdate(jobId, formData, filePaths);
    } catch (err) {
      dbg("createJobUpdate THREW (exception)", {
        name: err instanceof Error ? err.name : typeof err,
        message: err instanceof Error ? err.message : String(err),
        digest: err instanceof Error && "digest" in err ? String((err as Error & { digest?: string }).digest) : undefined,
      });
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
      if (IS_DEV) {
        patchCam({
          createJobUpdateResultJson: `THREW: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      return;
    }

    dbg("createJobUpdate raw result", result);

    if (IS_DEV) {
      patchCam({
        createJobUpdateResultJson: JSON.stringify(result ?? null),
        createJobUpdateResultIso: new Date().toISOString(),
      });
    }

    if (result && typeof result === "object" && "error" in result && result.error) {
      dbg("createJobUpdate returned error", { error: result.error });
      setError(result.error);
      return;
    }

    if (!isCreateJobUpdateSuccess(result)) {
      dbg("createJobUpdate unexpected shape (NOT resetting form)", {
        result,
        typeofResult: typeof result,
      });
      setError(
        `Save did not complete. The server did not return success. Got: ${JSON.stringify(result)}`
      );
      return;
    }

    dbg("createJobUpdate SUCCESS — clearing form");
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
      dbg("save unexpected catch", {
        name: unexpected instanceof Error ? unexpected.name : typeof unexpected,
        message: unexpected instanceof Error ? unexpected.message : String(unexpected),
      });
      console.error("[AddUpdateForm] save unexpected error", unexpected);
      setError(
        unexpected instanceof Error
          ? unexpected.message
          : "Something went wrong while saving. Please try again."
      );
    } finally {
      setLoading(false);
      setUploadProgress(null);
      if (IS_DEV) {
        setDevSubmitReport(devTrace || "(no trace lines)");
      }
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        {IS_DEV && (
          <div className="sticky top-0 z-[100] mb-4 max-h-[min(48vh,380px)] overflow-y-auto rounded-lg border-2 border-fuchsia-600 bg-zinc-950 p-2 text-fuchsia-100 shadow-lg">
            <p className="text-[10px] font-bold uppercase tracking-wide text-fuchsia-400">
              Dev — camera staging & save
            </p>
            <p className="mt-1 text-[9px] text-zinc-500">
              Scroll if needed. Values update on each event. Orange trace below is last submit only.
            </p>
            <p className="mt-2 rounded border border-fuchsia-500/60 bg-fuchsia-950/90 px-2 py-1.5 text-center font-mono text-[11px] font-bold tracking-wide text-fuchsia-100">
              Camera debug build: {CAMERA_DEBUG_BUILD}
            </p>
            {(() => {
              const rowClass =
                "grid grid-cols-1 gap-0.5 border-b border-zinc-800 pb-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-2";
              const renderRows = (rows: readonly [string, string][]) =>
                rows.map(([label, value]) => (
                  <div key={label} className={rowClass}>
                    <dt className="shrink-0 text-fuchsia-500">{label}</dt>
                    <dd className="break-all text-white">{value || "—"}</dd>
                  </div>
                ));
              const yesNo = (v: unknown) =>
                v === true ? "yes" : v === false ? "no" : "—";
              return (
                <>
                  <p className="mt-3 text-[9px] font-bold uppercase tracking-wide text-fuchsia-300">
                    Live state
                  </p>
                  <dl className="mt-1 space-y-1 font-mono text-[10px] leading-snug">
                    {renderRows([
                      ["staged (live)", String(staged.length)],
                      [
                        "preview object URLs (live)",
                        String(imagePreviewUrls.filter(Boolean).length),
                      ],
                    ])}
                  </dl>

                  <p className="mt-3 text-[9px] font-bold uppercase tracking-wide text-fuchsia-300">
                    Take photo — custom control (overlay)
                  </p>
                  <dl className="mt-1 space-y-1 font-mono text-[10px] leading-snug">
                    {renderRows([
                      ["custom: input mounted", yesNo(cameraFlowDebug.cameraInputMounted)],
                      ["custom: input id", String(cameraFlowDebug.cameraInputId ?? "—")],
                      [
                        "custom: input in document",
                        yesNo(cameraFlowDebug.cameraInputInDocument),
                      ],
                      [
                        "custom: pointerdown count",
                        String(cameraFlowDebug.takePhotoControlPointerDownCount ?? "—"),
                      ],
                      [
                        "custom: last pointerdown (ISO)",
                        String(cameraFlowDebug.lastTakePhotoPointerDownIso ?? "—"),
                      ],
                      [
                        "custom: onChange count",
                        String(cameraFlowDebug.customTakePhotoOnChangeCount ?? "—"),
                      ],
                      [
                        "custom: last onChange (ISO)",
                        String(cameraFlowDebug.lastCustomTakePhotoOnChangeIso ?? "—"),
                      ],
                    ])}
                  </dl>

                  <p className="mt-3 text-[9px] font-bold uppercase tracking-wide text-fuchsia-300">
                    Native camera input test (visible, dev)
                  </p>
                  <dl className="mt-1 space-y-1 font-mono text-[10px] leading-snug">
                    {renderRows([
                      [
                        "native test: input mounted",
                        yesNo(cameraFlowDebug.nativeCameraTestInputMounted),
                      ],
                      [
                        "native test: input id",
                        String(cameraFlowDebug.nativeCameraTestInputId ?? "—"),
                      ],
                      [
                        "native test: in document",
                        yesNo(cameraFlowDebug.nativeCameraTestInDocument),
                      ],
                      [
                        "native test: onChange count",
                        String(cameraFlowDebug.nativeCameraTestOnChangeCount ?? "—"),
                      ],
                      [
                        "native test: last onChange (ISO)",
                        String(cameraFlowDebug.lastNativeCameraTestOnChangeIso ?? "—"),
                      ],
                    ])}
                  </dl>

                  <p className="mt-3 text-[9px] font-bold uppercase tracking-wide text-fuchsia-300">
                    Choose files
                  </p>
                  <dl className="mt-1 space-y-1 font-mono text-[10px] leading-snug">
                    {renderRows([
                      [
                        "choose files: onChange count",
                        String(cameraFlowDebug.chooseFilesOnChangeCount ?? "—"),
                      ],
                      [
                        "choose files: last onChange (ISO)",
                        String(cameraFlowDebug.lastChooseFilesOnChangeIso ?? "—"),
                      ],
                    ])}
                  </dl>

                  <p className="mt-3 text-[9px] font-bold uppercase tracking-wide text-fuchsia-300">
                    Last camera handler (either path)
                  </p>
                  <dl className="mt-1 space-y-1 font-mono text-[10px] leading-snug">
                    {renderRows([
                      [
                        "last handler path",
                        String(cameraFlowDebug.lastCameraHandlerPath ?? "—"),
                      ],
                      [
                        "camera handler total (custom + native test)",
                        String(cameraFlowDebug.cameraOnChangeCount ?? "—"),
                      ],
                      [
                        "last camera onChange (ISO)",
                        String(cameraFlowDebug.lastCameraOnChangeIso ?? "—"),
                      ],
                      [
                        "last FileList length",
                        String(cameraFlowDebug.lastCameraFileListLength ?? "—"),
                      ],
                      [
                        "last files (raw)",
                        cameraFlowDebug.lastCameraFilesSnapshot != null
                          ? JSON.stringify(cameraFlowDebug.lastCameraFilesSnapshot)
                          : "—",
                      ],
                      ["clone phase", String(cameraFlowDebug.cameraClonePhase ?? "—")],
                      [
                        "cloned sizes",
                        cameraFlowDebug.clonedFileSizes != null
                          ? JSON.stringify(cameraFlowDebug.clonedFileSizes)
                          : "—",
                      ],
                      ["mergeFiles calls", String(cameraFlowDebug.mergeFilesCalls ?? "—")],
                      ["last merge (ISO)", String(cameraFlowDebug.lastMergeIso ?? "—")],
                      ["last merge source", String(cameraFlowDebug.lastMergeSource ?? "—")],
                      [
                        "merge staged before",
                        String(cameraFlowDebug.lastMergeStagedBefore ?? "—"),
                      ],
                      [
                        "merge valid count",
                        String(cameraFlowDebug.lastMergeValidCount ?? "—"),
                      ],
                      [
                        "merge staged after (exp.)",
                        String(cameraFlowDebug.lastMergeStagedAfterExpected ?? "—"),
                      ],
                      [
                        "last merge empty?",
                        String(cameraFlowDebug.lastMergeEmptySelection ?? "—"),
                      ],
                      [
                        "preview effect staged",
                        String(cameraFlowDebug.previewStagedCount ?? "—"),
                      ],
                      [
                        "preview objectUrl count",
                        String(cameraFlowDebug.previewObjectUrlCount ?? "—"),
                      ],
                      [
                        "submit handler runs",
                        String(cameraFlowDebug.submitHandlerRuns ?? "—"),
                      ],
                      [
                        "last submit (ISO)",
                        String(cameraFlowDebug.lastSubmitHandlerIso ?? "—"),
                      ],
                      [
                        "submit staged @ start",
                        String(cameraFlowDebug.submitStagedAtStart ?? "—"),
                      ],
                      ["submit blocked", String(cameraFlowDebug.submitBlocked ?? "—")],
                      [
                        "createJobUpdate called?",
                        String(cameraFlowDebug.createJobUpdateCalled ?? "—"),
                      ],
                      [
                        "CJU call (ISO)",
                        String(cameraFlowDebug.createJobUpdateCallIso ?? "—"),
                      ],
                      [
                        "CJU filePaths count",
                        String(cameraFlowDebug.createJobUpdateFilePathsCount ?? "—"),
                      ],
                      [
                        "CJU raw result",
                        cameraFlowDebug.createJobUpdateResultJson != null
                          ? String(cameraFlowDebug.createJobUpdateResultJson).slice(0, 400) +
                            (String(cameraFlowDebug.createJobUpdateResultJson).length > 400
                              ? "…"
                              : "")
                          : "—",
                      ],
                      [
                        "CJU result (ISO)",
                        String(cameraFlowDebug.createJobUpdateResultIso ?? "—"),
                      ],
                    ])}
                  </dl>
                </>
              );
            })()}
          </div>
        )}

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

        {IS_DEV && devSubmitReport && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
            <p className="font-semibold text-amber-900">Dev: last save attempt trace</p>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-snug">
              {devSubmitReport}
            </pre>
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
                ref={setCameraInputEl}
                id={`add-update-camera-${jobId}`}
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="Take photo"
                className="absolute inset-0 z-10 h-full w-full min-h-[44px] min-w-[8rem] cursor-pointer opacity-0"
                onPointerDownCapture={() => {
                  if (IS_DEV) {
                    setCameraFlowDebug((prev) => ({
                      ...prev,
                      takePhotoControlPointerDownCount:
                        (Number(prev.takePhotoControlPointerDownCount) || 0) + 1,
                      lastTakePhotoPointerDownIso: new Date().toISOString(),
                    }));
                  }
                }}
                onChange={(e) => handleCameraChange(e, "custom")}
              />
            </div>
          </div>
          {IS_DEV && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-zinc-600">
                Dev diagnostic — plain browser control (not styled). Same handler as Take photo.
              </p>
              <label
                htmlFor={`add-update-camera-native-test-${jobId}`}
                className="block text-sm text-zinc-800"
              >
                Native camera input test
              </label>
              <input
                ref={setCameraNativeTestInputEl}
                id={`add-update-camera-native-test-${jobId}`}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleCameraChange(e, "nativeTest")}
              />
            </div>
          )}
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
