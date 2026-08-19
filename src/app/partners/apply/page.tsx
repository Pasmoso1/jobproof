"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JobProofLogo } from "@/components/jobproof-logo";
import {
  PARTNER_AGREEMENT_VERSION,
  PARTNER_TYPES,
  type PartnerTypeValue,
} from "@/lib/partners/constants";
import { PartnerTypeCards } from "@/components/partners/partner-type-cards";
import { ProvinceSelect } from "@/components/canada/province-select";
import {
  CREATOR_AUDIENCE_FOCUS,
  CREATOR_PLATFORMS,
  MARKETING_PROMOTION_METHODS,
} from "@/lib/partners/apply-profiles";
import {
  PARTNER_PASSWORD_MIN_LENGTH,
  looksLikeEmail,
  partnerPasswordStrengthHint,
} from "@/lib/partners/username";
import {
  checkPartnerUsernameAvailableAction,
  getPartnerApplySessionState,
  signOutFromPartnerApply,
  submitPartnerApplication,
} from "@/app/partners/actions";
import type { PartnerApplyFlow } from "@/lib/partners/submit-application";
import {
  PARTNER_APPLY_PAGE_INTRO,
  PARTNER_APPLY_PAGE_TITLE,
  PARTNER_APPLY_SUCCESS_CTA_RETURN,
  PARTNER_APPLY_SUCCESS_CTA_STATUS,
  getPartnerApplyStatusCheckHref,
  getPartnerApplySuccessCopy,
} from "@/lib/partners/apply-success-copy";

type AuthUiState =
  | { status: "loading" }
  | {
      status: "signed_out";
      flow: "new_account";
    }
  | {
      status: "signed_in";
      flow: "existing_account";
      email: string;
      userId: string;
    };

export default function PartnerApplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [submittedFlow, setSubmittedFlow] =
    useState<PartnerApplyFlow>("new_account");
  const [existingAccount, setExistingAccount] = useState(false);
  const [authUi, setAuthUi] = useState<AuthUiState>({ status: "loading" });
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "unavailable" | "email"
  >("idle");
  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  const [partnerType, setPartnerType] = useState<PartnerTypeValue | "">("");
  const [province, setProvince] = useState("");
  const [, startTransition] = useTransition();

  async function refreshAuthState() {
    setAuthUi({ status: "loading" });
    try {
      const state = await getPartnerApplySessionState();
      if (state.signedIn && state.email && state.userId) {
        setAuthUi({
          status: "signed_in",
          flow: "existing_account",
          email: state.email,
          userId: state.userId,
        });
      } else {
        setAuthUi({ status: "signed_out", flow: "new_account" });
      }
    } catch {
      // Fail closed to guest flow so password fields appear and server still enforces.
      setAuthUi({ status: "signed_out", flow: "new_account" });
    }
  }

  useEffect(() => {
    void refreshAuthState();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("type");
    if (requested === "organization") {
      router.replace("/partners/organizations/apply");
      return;
    }
    if (requested === "creator" || requested === "marketing") {
      setPartnerType(requested);
    }
  }, [router]);

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
        authUi.status === "signed_in"
          ? "You’ll use email sign-in with your existing JobProof account to check status."
          : "You’ll use this email to sign in and check status (must match the application email)."
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
  }, [loginIdentifier, authUi.status]);

  async function onSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await signOutFromPartnerApply();
      setPassword("");
      setConfirmPassword("");
      setAuthUi({ status: "signed_out", flow: "new_account" });
      router.replace("/partners/apply");
      router.refresh();
      await refreshAuthState();
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (authUi.status === "loading") {
      setError("Still checking your account. Please wait a moment.");
      return;
    }
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setExistingAccount(false);
    try {
      const fd = new FormData(e.currentTarget);
      // Existing-account: force trusted email into the payload.
      if (authUi.status === "signed_in") {
        fd.set("email", authUi.email);
        fd.set("password", "");
        fd.set("confirm_password", "");
      }
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
      setSubmittedFlow(result.flow);
      setDone(true);
      // Refresh auth so the status CTA can route signed-in users directly.
      await refreshAuthState();
    } catch {
      setError("Could not submit your application. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const authLoading = authUi.status === "loading";
  const isExistingAccount = authUi.status === "signed_in";
  const passwordRequired = authUi.status === "signed_out";
  const passwordHint = partnerPasswordStrengthHint(password);
  const confirmMismatch =
    confirmPassword.length > 0 && password !== confirmPassword
      ? "Password and confirmation do not match."
      : null;
  const formDisabled = authLoading || loading || signingOut;
  const successCopy = getPartnerApplySuccessCopy(submittedFlow);
  const statusCheckHref = getPartnerApplyStatusCheckHref(
    authUi.status === "signed_in"
  );

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
          {PARTNER_APPLY_PAGE_TITLE}
        </h1>
        <p className="mt-2 text-zinc-600">{PARTNER_APPLY_PAGE_INTRO}</p>

        {done ? (
          <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-5 sm:p-6 text-green-950">
            <p className="text-base font-semibold sm:text-lg">
              {successCopy.heading}
            </p>
            <div className="mt-3 space-y-3 text-sm leading-relaxed sm:text-[15px]">
              {successCopy.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={statusCheckHref}
                className="inline-flex items-center justify-center rounded-xl bg-[#2436BB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2"
              >
                {PARTNER_APPLY_SUCCESS_CTA_STATUS}
              </Link>
              <Link
                href="/partners"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2"
              >
                {PARTNER_APPLY_SUCCESS_CTA_RETURN}
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-8 space-y-5 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
            aria-busy={authLoading}
          >
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
                    , then return here to finish your partner application.
                  </p>
                ) : null}
              </div>
            ) : null}

            {authLoading ? (
              <div
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
                role="status"
              >
                Checking account…
              </div>
            ) : null}

            {/* Honeypot */}
            <div
              className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
              aria-hidden="true"
            >
              <label htmlFor="company_website">Company website</label>
              <input
                id="company_website"
                name="company_website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <fieldset disabled={formDisabled} className="space-y-5 disabled:opacity-70">
              <PartnerTypeCards
                value={partnerType}
                onChange={(next) => {
                  if (next === "organization") {
                    router.push("/partners/organizations/apply");
                    return;
                  }
                  setPartnerType(next);
                }}
                error={fieldErrors.partner_type}
              />

              {partnerType ? (
                <>
              <Field
                label={
                  partnerType === "marketing"
                    ? "Individual or business name"
                    : partnerType === "creator"
                      ? "Name or channel name"
                      : "Organization name"
                }
                name="organization_name"
                required
                error={fieldErrors.organization_name}
              />
              <Field
                label="Contact name"
                name="contact_name"
                required
                error={fieldErrors.contact_name}
              />

              {isExistingAccount ? (
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-zinc-700"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    readOnly
                    value={authUi.email}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-zinc-900"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Locked to your signed-in JobProof account. This application will
                    be linked to that account.
                  </p>
                  {fieldErrors.email ? (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
                  ) : null}
                </div>
              ) : (
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  required
                  error={fieldErrors.email}
                />
              )}

              <Field label="Phone" name="phone" type="tel" error={fieldErrors.phone} />

              {partnerType === "creator" ? (
                <>
                  <div>
                    <label
                      htmlFor="primary_platform"
                      className="block text-sm font-medium text-zinc-700"
                    >
                      Primary platform <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="primary_platform"
                      name="primary_platform"
                      required
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                    >
                      <option value="">Select…</option>
                      {CREATOR_PLATFORMS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.primary_platform ? (
                      <p className="mt-1 text-sm text-red-600">
                        {fieldErrors.primary_platform}
                      </p>
                    ) : null}
                  </div>
                  <Field
                    label="Profile / channel URL"
                    name="website"
                    type="url"
                    required
                    placeholder="https://"
                    error={fieldErrors.website}
                  />
                  <Field
                    label="Additional platform links (optional)"
                    name="additional_links"
                    placeholder="Other profiles, one per line or comma-separated"
                  />
                  <Field
                    label="Approximate audience size"
                    name="estimated_audience"
                    required
                    placeholder="e.g. 12,000 followers"
                    error={fieldErrors.estimated_audience}
                  />
                  <div>
                    <label
                      htmlFor="primary_audience"
                      className="block text-sm font-medium text-zinc-700"
                    >
                      Primary audience
                    </label>
                    <select
                      id="primary_audience"
                      name="primary_audience"
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                    >
                      <option value="">Select…</option>
                      {CREATOR_AUDIENCE_FOCUS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="province"
                      className="block text-sm font-medium text-zinc-700"
                    >
                      Province / territory
                    </label>
                    <ProvinceSelect
                      id="province"
                      name="province"
                      value={province}
                      onChange={setProvince}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                    />
                    {fieldErrors.province ? (
                      <p className="mt-1 text-sm text-red-600">
                        {fieldErrors.province}
                      </p>
                    ) : null}
                  </div>
                  <TextArea
                    label="Short description of your content"
                    name="reason"
                    required
                    error={fieldErrors.reason}
                  />
                </>
              ) : null}

              {partnerType === "marketing" ? (
                <>
                  <Field
                    label="Website, LinkedIn, or primary business URL"
                    name="website"
                    type="url"
                    placeholder="https://"
                    error={fieldErrors.website}
                  />
                  <div>
                    <label
                      htmlFor="promotion_method"
                      className="block text-sm font-medium text-zinc-700"
                    >
                      Primary promotion method{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="promotion_method"
                      name="promotion_method"
                      required
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                    >
                      <option value="">Select…</option>
                      {MARKETING_PROMOTION_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.promotion_method ? (
                      <p className="mt-1 text-sm text-red-600">
                        {fieldErrors.promotion_method}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-zinc-500">
                      You do not need an existing audience. Performance marketing
                      and paid channels are welcome.
                    </p>
                  </div>
                  <TextArea
                    label="Tell us briefly how you expect to introduce JobProof to contractors."
                    name="reason"
                    required
                    error={fieldErrors.reason}
                  />
                </>
              ) : null}

              {partnerType ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  {PARTNER_TYPES.find((t) => t.value === partnerType)?.description}
                </p>
              ) : null}

              <div className="space-y-4 border-t border-zinc-200 pt-5">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">Account</h2>
                  {isExistingAccount ? (
                    <div className="mt-3 rounded-xl border border-[#2436BB]/25 bg-[#2436BB]/5 px-4 py-4 text-sm text-zinc-900">
                      <p className="font-semibold text-zinc-950">
                        You are signed in as {authUi.email}.
                      </p>
                      <p className="mt-2 text-zinc-700">
                        Your existing JobProof password will be used for Partner
                        Portal access after approval. You do not need to create a
                        new password.
                      </p>
                      <button
                        type="button"
                        onClick={onSignOut}
                        disabled={signingOut}
                        className="mt-3 text-sm font-semibold text-[#2436BB] hover:underline disabled:opacity-60"
                      >
                        {signingOut
                          ? "Signing out…"
                          : "Not you? Sign out and apply with another account."}
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-zinc-600">
                        Choose how you&apos;d like to sign in after your application
                        is approved.
                      </p>
                      <p className="mt-2 text-sm text-zinc-600">
                        You may use your email address or choose a unique username
                        (4–30 characters using letters, numbers, underscores, or
                        periods).
                      </p>
                      <p className="mt-2 text-sm text-zinc-600">
                        Create a password that you&apos;ll use to access your Partner
                        Portal after approval.
                      </p>
                    </>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="username"
                    className="block text-sm font-medium text-zinc-700"
                  >
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
                      hint={`At least ${PARTNER_PASSWORD_MIN_LENGTH} characters.`}
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
                ) : isExistingAccount ? (
                  <>
                    <input type="hidden" name="password" value="" />
                    <input type="hidden" name="confirm_password" value="" />
                  </>
                ) : null}
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
                disabled={formDisabled}
                className="w-full rounded-xl bg-[#2436BB] px-6 py-3 text-base font-semibold text-white hover:bg-[#1c2a96] disabled:opacity-60"
              >
                {authLoading
                  ? "Checking account…"
                  : loading
                    ? "Submitting…"
                    : "Submit application"}
              </button>
                </>
              ) : (
                <p className="text-sm text-zinc-600">
                  Select Creator or Marketing to continue. Organization Partners
                  use a dedicated application.
                </p>
              )}
            </fieldset>
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
          aria-label={
            show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`
          }
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {hint && !error ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
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
