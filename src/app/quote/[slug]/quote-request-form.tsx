"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_QUOTE_REQUEST_PHOTOS,
  MAX_QUOTE_REQUEST_PHOTO_BYTES,
  QUOTE_REQUEST_STORAGE_BUCKET,
} from "@/lib/quote-requests/constants";
import {
  friendlyQuotePhotoUploadError,
  validateQuotePhotoMeta,
} from "@/lib/quote-requests/photo-upload";
import {
  createQuotePhotoUploadUrl,
  deleteQuotePhotoUpload,
  submitPublicQuoteRequest,
} from "./actions";

const FIELD_INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB] sm:text-sm";

const PHOTO_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB] disabled:cursor-not-allowed disabled:opacity-50";

type PhotoUploadStatus = "uploading" | "uploaded" | "failed";

type PhotoUploadItem = {
  id: string;
  fileName: string;
  file: File;
  status: PhotoUploadStatus;
  filePath?: string;
  error?: string;
};

function isNextRedirectError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const digest = "digest" in err ? (err as { digest?: unknown }).digest : undefined;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

function newUploadSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function QuoteRequestForm({
  slug,
  contractorPhone,
}: {
  slug: string;
  contractorPhone: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadSessionId] = useState(newUploadSessionId);
  const [photos, setPhotos] = useState<PhotoUploadItem[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PhotoUploadItem[]>([]);

  const syncPhotosRef = useCallback((next: PhotoUploadItem[]) => {
    photosRef.current = next;
    setPhotos(next);
  }, []);

  const updatePhoto = useCallback((id: string, patch: Partial<PhotoUploadItem>) => {
    setPhotos((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      photosRef.current = next;
      return next;
    });
  }, []);

  const atPhotoLimit = photos.length >= MAX_QUOTE_REQUEST_PHOTOS;
  const uploadingCount = photos.filter((p) => p.status === "uploading").length;
  const hasUploading = uploadingCount > 0;
  const hasFailed = photos.some((p) => p.status === "failed");

  const uploadOne = useCallback(
    async (id: string, file: File) => {
      const metaCheck = validateQuotePhotoMeta({
        mimeType: file.type,
        byteSize: file.size,
      });
      if (!metaCheck.ok) {
        updatePhoto(id, { status: "failed", error: metaCheck.error });
        return;
      }

      updatePhoto(id, { status: "uploading", error: undefined });

      try {
        const signed = await createQuotePhotoUploadUrl(slug, uploadSessionId, {
          fileName: file.name,
          mimeType: metaCheck.mime,
          byteSize: file.size,
        });

        if (!signed.success) {
          updatePhoto(id, { status: "failed", error: signed.error });
          return;
        }

        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from(QUOTE_REQUEST_STORAGE_BUCKET)
          .uploadToSignedUrl(signed.path, signed.token, file, {
            contentType: metaCheck.mime,
            upsert: false,
          });

        if (uploadError) {
          updatePhoto(id, {
            status: "failed",
            error: friendlyQuotePhotoUploadError(uploadError),
          });
          return;
        }

        updatePhoto(id, {
          status: "uploaded",
          filePath: signed.path,
          error: undefined,
        });
      } catch (err) {
        updatePhoto(id, {
          status: "failed",
          error: friendlyQuotePhotoUploadError(err),
        });
      }
    },
    [slug, updatePhoto, uploadSessionId]
  );

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const available = MAX_QUOTE_REQUEST_PHOTOS - photosRef.current.length;
      if (available <= 0) return;

      const files = Array.from(incoming).slice(0, available);
      const newItems: PhotoUploadItem[] = files.map((file) => ({
        id: newUploadSessionId(),
        fileName: file.name || "photo.jpg",
        file,
        status: "uploading",
      }));

      const next = [...photosRef.current, ...newItems];
      syncPhotosRef(next);

      for (const item of newItems) {
        void uploadOne(item.id, item.file);
      }
    },
    [syncPhotosRef, uploadOne]
  );

  function onUploadPhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files?.length) {
      addFiles(files);
    }
    e.target.value = "";
  }

  function onCameraPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files?.length) {
      addFiles(files);
    }
    e.target.value = "";
  }

  async function removePhoto(item: PhotoUploadItem) {
    if (item.status === "uploaded" && item.filePath) {
      await deleteQuotePhotoUpload(slug, uploadSessionId, item.filePath);
    }
    syncPhotosRef(photosRef.current.filter((p) => p.id !== item.id));
  }

  function retryPhoto(item: PhotoUploadItem) {
    updatePhoto(item.id, { status: "uploading", error: undefined });
    void uploadOne(item.id, item.file);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = formRef.current ?? e.currentTarget;
    if (!form.reportValidity()) {
      return;
    }

    if (hasUploading) {
      setError("Please wait for photos to finish uploading.");
      return;
    }

    if (hasFailed) {
      setError("Remove or retry failed photos before submitting.");
      return;
    }

    const uploadedPaths = photosRef.current
      .filter((p) => p.status === "uploaded" && p.filePath)
      .map((p) => p.filePath as string);

    setLoading(true);
    try {
      const formData = new FormData(form);
      const result = await submitPublicQuoteRequest(slug, {
        customerName: String(formData.get("customerName") ?? ""),
        customerEmail: String(formData.get("customerEmail") ?? ""),
        customerPhone: String(formData.get("customerPhone") ?? ""),
        propertyAddress: String(formData.get("propertyAddress") ?? ""),
        projectType: String(formData.get("projectType") ?? ""),
        description: String(formData.get("description") ?? ""),
        isUrgent: formData.get("isUrgent") === "on",
        uploadSessionId,
        photoPaths: uploadedPaths,
      });

      if (result && "success" in result && !result.success) {
        setError(result.error);
      }
    } catch (err) {
      if (isNextRedirectError(err)) {
        throw err;
      }
      console.error("[QuoteRequestForm] submit failed", err);
      setError(
        err instanceof Error
          ? friendlyQuotePhotoUploadError(err)
          : "Could not submit your request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const maxPhotoMb = MAX_QUOTE_REQUEST_PHOTO_BYTES / (1024 * 1024);

  const uploadProgressLabel = useMemo(() => {
    if (!hasUploading) return null;
    const done = photos.filter((p) => p.status === "uploaded").length;
    const total = photos.length;
    const current = Math.min(done + 1, total);
    return `Uploading photo ${current} of ${total}…`;
  }, [hasUploading, photos]);

  return (
    <>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onUploadPhotosChange}
        className="hidden"
        tabIndex={-1}
        aria-hidden
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onCameraPhotoChange}
        className="hidden"
        tabIndex={-1}
        aria-hidden
      />

      <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800">Name</span>
            <input
              name="customerName"
              required
              autoComplete="name"
              className={FIELD_INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-800">Email</span>
            <input
              name="customerEmail"
              type="email"
              required
              autoComplete="email"
              className={FIELD_INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-800">Phone</span>
            <input
              name="customerPhone"
              type="tel"
              autoComplete="tel"
              className={FIELD_INPUT_CLASS}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800">Property address</span>
            <input
              name="propertyAddress"
              required
              autoComplete="street-address"
              className={FIELD_INPUT_CLASS}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800">Project type</span>
            <input
              name="projectType"
              required
              placeholder="e.g. Interior painting, deck repair"
              list="project-type-suggestions"
              className={FIELD_INPUT_CLASS}
            />
            <datalist id="project-type-suggestions">
              <option value="Interior painting" />
              <option value="Exterior painting" />
              <option value="Landscaping" />
              <option value="Bathroom renovation" />
              <option value="Kitchen renovation" />
              <option value="Roof repair" />
              <option value="Fence or deck" />
              <option value="General handyman" />
            </datalist>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800">Description</span>
            <textarea
              name="description"
              required
              rows={5}
              placeholder="Describe the project, timeline, and anything else we should know."
              className={FIELD_INPUT_CLASS}
            />
          </label>

          <div className="block sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800">Project photos</span>
            <p className="mt-1 text-sm text-zinc-600">
              Upload photos or take pictures with your phone camera. Photos help the contractor
              understand the job before calling or visiting.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={atPhotoLimit}
                onClick={() => uploadInputRef.current?.click()}
                className={PHOTO_BUTTON_CLASS}
              >
                Add photos or take pictures
              </button>
              <button
                type="button"
                disabled={atPhotoLimit}
                onClick={() => cameraInputRef.current?.click()}
                className={PHOTO_BUTTON_CLASS}
              >
                Take a photo
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Optional. Up to {MAX_QUOTE_REQUEST_PHOTOS} photos, {maxPhotoMb} MB each.
              {photos.length > 0 ? ` ${photos.length} selected.` : ""}
            </p>
            {uploadProgressLabel ? (
              <p className="mt-2 text-sm font-medium text-[#2436BB]">{uploadProgressLabel}</p>
            ) : null}
            {photos.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {photos.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-800">{item.fileName}</p>
                      <p
                        className={
                          item.status === "failed"
                            ? "mt-0.5 text-red-700"
                            : item.status === "uploaded"
                              ? "mt-0.5 text-green-700"
                              : "mt-0.5 text-zinc-600"
                        }
                      >
                        {item.status === "uploading"
                          ? `Uploading photo ${index + 1} of ${photos.length}…`
                          : item.status === "uploaded"
                            ? "Uploaded"
                            : item.error ?? "Failed"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {item.status === "failed" ? (
                        <button
                          type="button"
                          onClick={() => retryPhoto(item)}
                          className="text-[#2436BB] hover:underline"
                        >
                          Retry
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void removePhoto(item)}
                        className="text-zinc-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <label className="flex items-start gap-3">
            <input
              name="isUrgent"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-[#2436BB]"
            />
            <span>
              <span className="text-sm font-medium text-zinc-900">This project is urgent.</span>
              <span className="mt-1 block text-sm text-zinc-700">
                Urgent requests are flagged for immediate attention. Most contractors will try to
                respond as quickly as possible, but response times may vary depending on
                availability.
              </span>
            </span>
          </label>
          <p className="mt-3 text-sm text-zinc-700">
            If your situation is urgent, we recommend submitting your project details first and then
            calling the contractor directly.
          </p>
          {contractorPhone.trim() ? (
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              <a
                href={`tel:${contractorPhone.replace(/\s/g, "")}`}
                className="text-[#2436BB] hover:underline"
              >
                {contractorPhone}
              </a>
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={loading || hasUploading}
          className="w-full rounded-lg bg-[#2436BB] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1c2a96] disabled:opacity-60"
        >
          {loading ? "Submitting…" : hasUploading ? "Waiting for photos…" : "Submit quote request"}
        </button>
      </form>
    </>
  );
}
