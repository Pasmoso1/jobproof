"use client";

import { useState, useRef } from "react";
import { submitPublicQuoteRequest } from "./actions";
import { MAX_QUOTE_REQUEST_PHOTOS, MAX_QUOTE_REQUEST_PHOTO_BYTES } from "@/lib/quote-requests/constants";

export function QuoteRequestForm({
  slug,
  contractorPhone,
}: {
  slug: string;
  contractorPhone: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  function onPhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoCount(e.target.files?.length ?? 0);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const result = await submitPublicQuoteRequest(slug, formData);
      if (result && "success" in result && !result.success) {
        setError(result.error);
      }
    } catch {
      /* redirect on success */
    } finally {
      setLoading(false);
    }
  }

  return (
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
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-800">Email</span>
          <input
            name="customerEmail"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-800">Phone</span>
          <input
            name="customerPhone"
            type="tel"
            autoComplete="tel"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-zinc-800">Property address</span>
          <input
            name="propertyAddress"
            required
            autoComplete="street-address"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-zinc-800">Project type</span>
          <input
            name="projectType"
            required
            placeholder="e.g. Interior painting, deck repair"
            list="project-type-suggestions"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
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
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-zinc-800">Photos</span>
          <input
            name="photos"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
            multiple
            onChange={onPhotosChange}
            className="mt-1 w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Up to {MAX_QUOTE_REQUEST_PHOTOS} photos, {MAX_QUOTE_REQUEST_PHOTO_BYTES / (1024 * 1024)} MB
            each. {photoCount > 0 ? `${photoCount} selected.` : ""}
          </p>
        </label>
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
              Urgent requests are flagged for immediate attention. Most contractors will try to respond
              as quickly as possible, but response times may vary depending on availability.
            </span>
          </span>
        </label>
        <p className="mt-3 text-sm text-zinc-700">
          If your situation is urgent, we recommend submitting your project details first and then
          calling the contractor directly.
        </p>
        {contractorPhone.trim() ? (
          <p className="mt-2 text-sm font-semibold text-zinc-900">
            <a href={`tel:${contractorPhone.replace(/\s/g, "")}`} className="text-[#2436BB] hover:underline">
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
  );
}
