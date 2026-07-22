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
  looksLikeEmail,
  partnerPasswordStrengthHint,
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
  const [authChecked, setAuthChecked] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "unavailable" | "email"
  >("idle");
  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        setSignedInEmail(data.user?.email?.trim().toLowerCase() ?? null);
        setAuthChecked(true);
      })
      .catch(() => {
        setSignedInEmail(null);
        setAuthChecked(true);
      });
  }, []);

  useEffect(() => {
    const value = loginIdentifier.trim();
    if (!value) {
      setUsernameStatus("idle");
      setUsernameHint(null);
      return;
    }
    if (looksLikeEmail(value)) {
      setUsernameStatus("email");
      setUsernameHint(
        "You’ll sign in with this email after approval (must match the email above)."
      );
      return;
    }
    if (value.length < 4) {
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
  }, [loginIdentifier]);

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

  // Only skip password fields after auth check confirms an existing session.
  // Guests (and while auth is still loading) always see password fields.
  const passwordRequired = authChecked ? !signedInEmail : true;
  const passwordHint = partnerPasswordStrengthHint(password);
  const confirmMismatch =
    confirmPassword.length > 0 && password !== confirmPassword
      ? "Password and confirmation do not match."
      : null;

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
          Tell us about your organization and create sign-in credentials for
          Partner Portal access after approval.
        </p>

        {done ? (
          <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6 text-green-950">
            <p className="font-semibold">Application submitted</p>
            <p className="mt-2 text-sm">
              Thanks — we sent a confirmation email. Confirm your email if asked,
              then you can sign in with your username or email to check application
              status. Partner Portal access opens after approval.
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
                application to your existing account. Choose a username or email
                below — you can keep using your current password.
              </div>
            ) : null}

            {/* Honeypot */}
            <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
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
                  Choose how you&apos;d like to sign in after your application is
                  approved.
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  You may use your email address or choose a unique username (4–30
                  characters using letters, numbers, underscores, or periods).
                </p>
                {passwordRequired ? (
                  <p className="mt-2 text-sm text-zinc-600">
                    Create a password that you&apos;ll use to access your Partner
                    Portal after approval.
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-zinc-700">
                  Username or Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="username"
                  name="username"
                  required
                  autoComplete="username"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="username or you@example.com"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                />
                {fieldErrors.username ? (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.username}</p>
                ) : usernameHint ? (
                  <p
                    className={`mt-1 text-sm ${
                      usernameStatus === "available" || usernameStatus === "email"
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
                  <PasswordField
                    id="password"
                    name="password"
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    show={showPassword}
                    onToggleShow={() => setShowPassword((v) => !v)}
                    error={fieldErrors.password ?? passwordHint ?? undefined}
                    hint={`At least ${PARTNER_PASSWORD_MIN_LENGTH} characters. Passwords are stored securely by JobProof authentication — never in your application record.`}
                    autoComplete="new-password"
                  />
                  <PasswordField
                    id="confirm_password"
                    name="confirm_password"
                    label="Confirm Password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    show={showConfirmPassword}
                    onToggleShow={() => setShowConfirmPassword((v) => !v)}
                    error={
                      fieldErrors.confirm_password ?? confirmMismatch ?? undefined
                    }
                    autoComplete="new-password"
                  />
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

function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  error,
  hint,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  error?: string;
  hint?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-700">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          minLength={PARTNER_PASSWORD_MIN_LENGTH}
          className="block w-full rounded-lg border border-zinc-300 px-4 py-2.5 pr-20 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-[#2436BB] hover:underline"
          aria-pressed={show}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {hint && !error ? (
        <p className="mt-1 text-xs text-zinc-500">{hint}</p>
      ) : null}
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
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
