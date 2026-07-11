"use client";

import { useState, useTransition, type FormEvent } from "react";
import { submitFeatureRequest } from "../actions";

export function FeatureRequestForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await submitFeatureRequest(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setDone(true);
      e.currentTarget.reset();
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-5 text-sm text-green-900">
        <p className="font-semibold">Feature request submitted</p>
        <p className="mt-1">
          Thanks—we review ideas from contractors when planning what to build next.
        </p>
        <button
          type="button"
          className="mt-3 text-sm font-medium text-[#2436BB] hover:underline"
          onClick={() => setDone(false)}
        >
          Submit another idea
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div>
        <label htmlFor="fr-title" className="block text-sm font-medium text-zinc-800">
          Title
        </label>
        <input
          id="fr-title"
          name="title"
          required
          maxLength={120}
          placeholder="Short name for your idea"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2436BB]"
        />
      </div>
      <div>
        <label htmlFor="fr-category" className="block text-sm font-medium text-zinc-800">
          Category
        </label>
        <select
          id="fr-category"
          name="category"
          required
          defaultValue="quoting"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2436BB]"
        >
          <option value="quoting">Quoting</option>
          <option value="customers">Customers</option>
          <option value="billing">Billing</option>
          <option value="mobile">Mobile</option>
          <option value="integrations">Integrations</option>
          <option value="reporting">Reporting</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="fr-description" className="block text-sm font-medium text-zinc-800">
          Description
        </label>
        <textarea
          id="fr-description"
          name="description"
          required
          rows={6}
          placeholder="What should JobProof do, and how would it help your business?"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2436BB]"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96] disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit feature request"}
      </button>
    </form>
  );
}
