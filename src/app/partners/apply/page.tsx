"use client";

import { useState } from "react";
import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";
import {
  PARTNER_AGREEMENT_VERSION,
  PARTNER_TYPES,
} from "@/lib/partners/constants";
import { submitPartnerApplication } from "@/app/partners/actions";

export default function PartnerApplyPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    const fd = new FormData(e.currentTarget);
    const result = await submitPartnerApplication(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      return;
    }
    setDone(true);
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/partners">
            <JobProofLogo />
          </Link>
          <Link href="/partners" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            ← Partner program
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
          Apply to become a partner
        </h1>
        <p className="mt-2 text-zinc-600">
          Tell us about your organization and how you work with contractors. Applications are
          reviewed manually.
        </p>

        {done ? (
          <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6 text-green-950">
            <p className="font-semibold">Application submitted</p>
            <p className="mt-2 text-sm">
              Thanks — we sent a confirmation email. Our team will review your application and
              follow up.
            </p>
            <Link
              href="/partners"
              className="mt-4 inline-block text-sm font-medium text-[#2436BB] hover:underline"
            >
              Back to Partner Program
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            {error ? (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <Field label="Organization name" name="organization_name" required error={fieldErrors.organization_name} />
            <Field label="Contact name" name="contact_name" required error={fieldErrors.contact_name} />
            <Field label="Email" name="email" type="email" required error={fieldErrors.email} />
            <Field label="Phone" name="phone" type="tel" error={fieldErrors.phone} />
            <Field label="Website" name="website" type="url" placeholder="https://" />

            <div>
              <label htmlFor="partner_type" className="block text-sm font-medium text-zinc-700">
                Partner type <span className="text-red-500">*</span>
              </label>
              <select
                id="partner_type"
                name="partner_type"
                required
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              >
                <option value="">Select…</option>
                {PARTNER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {fieldErrors.partner_type ? (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.partner_type}</p>
              ) : null}
            </div>

            <Field
              label="Estimated contractor audience size"
              name="estimated_audience"
              placeholder="e.g. 500 contractors in Ontario"
            />

            <TextArea
              label="How do you plan to promote JobProof?"
              name="promotion_plan"
              required
              error={fieldErrors.promotion_plan}
            />
            <TextArea
              label="Why would you like to become a partner?"
              name="reason"
              required
              error={fieldErrors.reason}
            />

            <div>
              <label className="flex items-start gap-3 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  name="agreement_accepted"
                  required
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[#2436BB] focus:ring-[#2436BB]"
                />
                <span>
                  I have read and agree to the{" "}
                  <Link
                    href="/partners/agreement"
                    target="_blank"
                    className="font-medium text-[#2436BB] hover:underline"
                  >
                    Partner Program Agreement
                  </Link>{" "}
                  (version {PARTNER_AGREEMENT_VERSION}).
                </span>
              </label>
              {fieldErrors.agreement_accepted ? (
                <p className="mt-1 text-sm text-red-600">
                  {fieldErrors.agreement_accepted}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#2436BB] px-6 py-3 text-base font-semibold text-white hover:bg-[#1c2a96] disabled:opacity-60"
            >
              {loading ? "Submitting…" : "Submit application"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  error,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
      />
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function TextArea({
  label,
  name,
  required,
  error,
}: {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      <textarea
        id={name}
        name={name}
        required={required}
        rows={4}
        className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
      />
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
