"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";
import {
  PARTNER_AGREEMENT_VERSION,
  PARTNER_TYPES,
} from "@/lib/partners/constants";
import {
  PARTNER_PASSWORD_MIN_LENGTH,
  PARTNER_USERNAME_MAX_LENGTH,
  PARTNER_USERNAME_MIN_LENGTH,
} from "@/lib/partners/username";
import {
  checkPartnerUsernameAvailableAction,
  submitPartnerApplication,
} from "@/app/partners/actions";
import { createClient } from "@/lib/supabase/client";

export default function PartnerApplyPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "unavailable"
  >("idle");
  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        setSignedInEmail(data.user?.email?.trim().toLowerCase() ?? null);
      });
  }, []);

  useEffect(() => {
    const value = username.trim();
    if (value.length < PARTNER_USERNAME_MIN_LENGTH) {
      setUsernameStatus("idle");
      setUsernameHint(null);
      return;
    }
    setUsernameStatus("checking");
    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const result = await checkPartnerUsernameAvailableAction(value);
        if (!result.available) {
          setUsernameStatus("unavailable");
          setUsernameHint(
            result.reason === "reserved"
              ? "That username is reserved."
              : result.reason === "invalid"
                ? "Username format is invalid."
                : "That username is taken."
          );
          return;
        }
        setUsernameStatus("available");
        setUsernameHint("Username is available.");
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [username]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setExistingAccount(false);
    try {
      const fd = new FormData(e.currentTarget);
      const result = await submitPartnerApplication(fd);
      if (!result || typeof result !== "object" || !("success" in result)) {
        setError("Could not submit your application. Please try again.");
        return;
      }
      if (!result.success) {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        if (result.code === "existing_account") setExistingAccount(true);
        return;
      }
      setDone(true);
    } catch {
      setError("Could not submit your application. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const passwordRequired = !signedInEmail;

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
          Tell us about your organization and choose a username and password for
          Partner Portal access after approval.
        </p>

        {done ? (
          <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6 text-green-950">
            <p className="font-semibold">Application submitted</p>
            <p className="mt-2 text-sm">
              Thanks — we sent a confirmation email. Confirm your email if asked,
              then you can sign in with your username to check application status.
              Partner Portal access opens after approval.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/login?next=${encodeURIComponent("/partner/status")}`}
                className="inline-block text-sm font-medium text-[#2436BB] hover:underline"
              >
                Sign in to check status
              </Link>
              <Link
                href="/partners"
                className="inline-block text-sm font-medium text-[#2436BB] hover:underline"
              >
                Back to Partner Program
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            {error ? (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
                {existingAccount ? (
                  <p className="mt-2">
                    <Link
                      href={`/login?next=${encodeURIComponent("/partners/apply")}`}
                      className="font-medium underline"
                    >
                      Sign in with your existing JobProof account
                    </Link>{" "}
                    , then return here to finish your partner application (password
                    not required while signed in).
                  </p>
                ) : null}
              </div>
            ) : null}

            {signedInEmail ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                Signed in as <strong>{signedInEmail}</strong>. We&apos;ll link this
                application to your existing account. Choose a partner username
                below — you can keep using your current password.
              </div>
            ) : null}

            {/* Honeypot */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="company_website">Company website</label>
              <input
                id="company_website"
                name="company_website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <Field label="Organization name" name="organization_name" required error={fieldErrors.organization_name} />
            <Field label="Contact name" name="contact_name" required error={fieldErrors.contact_name} />
            <Field
              label="Email"
              name="email"
              type="email"
              required
              error={fieldErrors.email}
              defaultValue={signedInEmail ?? undefined}
            />
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

            <div className="space-y-4 border-t border-zinc-200 pt-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Account</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Choose a partner username ({PARTNER_USERNAME_MIN_LENGTH}–
                  {PARTNER_USERNAME_MAX_LENGTH} characters: letters, numbers,
                  underscores, periods). After approval you&apos;ll sign in with
                  this username and your password.
                </p>
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-zinc-700">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  id="username"
                  name="username"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  minLength={PARTNER_USERNAME_MIN_LENGTH}
                  maxLength={PARTNER_USERNAME_MAX_LENGTH}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                />
                {fieldErrors.username ? (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.username}</p>
                ) : usernameHint ? (
                  <p
                    className={`mt-1 text-sm ${
                      usernameStatus === "available"
                        ? "text-green-700"
                        : usernameStatus === "unavailable"
                          ? "text-red-600"
                          : "text-zinc-500"
                    }`}
                  >
                    {usernameStatus === "checking" ? "Checking…" : usernameHint}
                  </p>
                ) : null}
              </div>

              {passwordRequired ? (
                <>
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      autoComplete="new-password"
                      minLength={PARTNER_PASSWORD_MIN_LENGTH}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      At least {PARTNER_PASSWORD_MIN_LENGTH} characters. Passwords are
                      stored securely by JobProof authentication — never in your
                      application record.
                    </p>
                    {fieldErrors.password ? (
                      <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
                    ) : null}
                  </div>
                  <div>
                    <label
                      htmlFor="confirm_password"
                      className="block text-sm font-medium text-zinc-700"
                    >
                      Confirm password <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="confirm_password"
                      name="confirm_password"
                      type="password"
                      required
                      autoComplete="new-password"
                      minLength={PARTNER_PASSWORD_MIN_LENGTH}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                    />
                    {fieldErrors.confirm_password ? (
                      <p className="mt-1 text-sm text-red-600">
                        {fieldErrors.confirm_password}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <input type="hidden" name="password" value="" />
                  <input type="hidden" name="confirm_password" value="" />
                </>
              )}
            </div>

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
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  defaultValue?: string;
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
        defaultValue={defaultValue}
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
