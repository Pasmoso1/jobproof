"use client";

import { useState, useRef } from "react";
import { submitPublicQuoteRequest } from "./actions";
import { MAX_QUOTE_REQUEST_PHOTOS, MAX_QUOTE_REQUEST_PHOTO_BYTES } from "@/lib/quote-requests/constants";

const FIELD_INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB] sm:text-sm";

const PHOTO_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB] disabled:cursor-not-allowed disabled:opacity-50";

function isNextRedirectError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const digest = "digest" in err ? (err as { digest?: unknown }).digest : undefined;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

function mergePhotoFiles(existing: File[], incoming: FileList | File[]): File[] {
  const merged = [...existing];
  for (const file of Array.from(incoming)) {
    if (merged.length >= MAX_QUOTE_REQUEST_PHOTOS) break;
    merged.push(file);
  }
  return merged;
}

function validatePhotosClient(files: File[]): string | null {
  if (files.length > MAX_QUOTE_REQUEST_PHOTOS) {
    return `You can upload up to ${MAX_QUOTE_REQUEST_PHOTOS} photos.`;
  }
  const maxMb = MAX_QUOTE_REQUEST_PHOTO_BYTES / (1024 * 1024);
  for (const file of files) {
    if (file.size > MAX_QUOTE_REQUEST_PHOTO_BYTES) {
      return `"${file.name}" is too large. Each photo must be ${maxMb} MB or smaller.`;
    }
  }
  return null;
}

function syncPhotosToHiddenInput(input: HTMLInputElement | null, files: File[]) {
  if (!input) return;
  const dt = new DataTransfer();
  for (const file of files) {
    dt.items.add(file);
  }
  input.files = dt.files;
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
  const [photos, setPhotos] = useState<File[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const photosHiddenRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const atPhotoLimit = photos.length >= MAX_QUOTE_REQUEST_PHOTOS;

  function onUploadPhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files?.length) {
      setPhotos((prev) => mergePhotoFiles(prev, files));
    }
    e.target.value = "";
  }

  function onCameraPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files?.length) {
      setPhotos((prev) => mergePhotoFiles(prev, files));
    }
    e.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = formRef.current ?? e.currentTarget;
    if (!form.reportValidity()) {
      return;
    }

    const photoError = validatePhotosClient(photos);
    if (photoError) {
      setError(photoError);
      return;
    }

    setLoading(true);
    try {
      syncPhotosToHiddenInput(photosHiddenRef.current, photos);
      const formData = new FormData(form);

      const result = await submitPublicQuoteRequest(slug, formData);
      if (result && "success" in result && !result.success) {
        setError(result.error);
      }
    } catch (err) {
      if (isNextRedirectError(err)) {
        throw err;
      }
      console.error("[QuoteRequestForm] submit failed", err);
      const message =
        err instanceof Error && /body exceeded|413/i.test(err.message)
          ? "Photos are too large to upload. Try fewer or smaller photos."
          : err instanceof Error
            ? err.message
            : "Could not submit your request. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const maxPhotoMb = MAX_QUOTE_REQUEST_PHOTO_BYTES / (1024 * 1024);

  return (
    <>
      {/* Pickers live outside the form so they cannot block native submit/validation. */}
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
            <input
              ref={photosHiddenRef}
              type="file"
              name="photos"
              multiple
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />
            <p className="mt-2 text-xs text-zinc-500">
              Optional. Up to {MAX_QUOTE_REQUEST_PHOTOS} photos, {maxPhotoMb} MB each.
              {photos.length > 0 ? ` ${photos.length} selected.` : ""}
            </p>
            {photos.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {photos.map((file, index) => (
                  <li
                    key={`${file.name}-${file.lastModified}-${file.size}-${index}`}
                    className="flex items-center justify-between gap-2 text-xs text-zinc-700"
                  >
                    <span className="min-w-0 truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="shrink-0 text-zinc-500 hover:text-red-600"
                    >
                      Remove
                    </button>
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
          disabled={loading}
          className="w-full rounded-lg bg-[#2436BB] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1c2a96] disabled:opacity-60"
        >
          {loading ? "Submitting…" : "Submit quote request"}
        </button>
      </form>
    </>
  );
}
