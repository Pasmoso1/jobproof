"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { convertEstimateToJob } from "@/app/(app)/estimates/estimate-actions";

export function ConvertToJobForm({ estimateId }: { estimateId: string }) {
  const router = useRouter();
  const [serviceCategory, setServiceCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("service_category", serviceCategory.trim());
      fd.set("start_date", startDate.trim());
      fd.set("estimated_completion_date", estimatedCompletionDate.trim());
      const res = await convertEstimateToJob(estimateId, fd);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("fieldErrors" in res && res.fieldErrors) {
        setFieldErrors(res.fieldErrors);
        return;
      }
      const jobId = (res as { jobId: string }).jobId;
      router.push(`/jobs/${jobId}?convertedFromEstimate=1`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Trade / service type <span className="text-red-500">*</span>
        </label>
        <input
          value={serviceCategory}
          onChange={(e) => {
            setServiceCategory(e.target.value);
            setFieldErrors((p) => {
              const n = { ...p };
              delete n.service_category;
              return n;
            });
          }}
          placeholder="e.g. Electrical, Plumbing, Renovation"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
        />
        {fieldErrors.service_category && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.service_category}</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Estimated start date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900"
          />
          {fieldErrors.start_date && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.start_date}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Estimated completion date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={estimatedCompletionDate}
            onChange={(e) => setEstimatedCompletionDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900"
          />
          {fieldErrors.estimated_completion_date && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.estimated_completion_date}</p>
          )}
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex rounded-lg bg-[#2436BB] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create job from estimate"}
      </button>
    </form>
  );
}
