"use client";

/* eslint-disable react-hooks/set-state-in-effect -- mirrors /partners/apply session + username availability bootstrap */

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";
import {
  PARTNER_AGREEMENT_PATH,
} from "@/lib/partners/constants";
import {
  PARTNER_PASSWORD_MIN_LENGTH,
  looksLikeEmail,
  partnerPasswordStrengthHint,
} from "@/lib/partners/username";
import {
  clearPartnerApplicationDraft,
  collectPartnerApplicationDraftFields,
  loadPartnerApplicationDraft,
  markPartnerApplicationDraftRestored,
  ORGANIZATION_APPLY_LOGIN_NEXT,
  savePartnerApplicationDraft,
} from "@/lib/partners/application-draft";
import {
  partnerExistingAccountLoginHref,
  type PartnerExistingAccountContinueKind,
} from "@/lib/partners/apply-existing-account";
import { ExistingAccountContinuePanel } from "@/components/partners/existing-account-continue-panel";
import {
  checkPartnerUsernameAvailableAction,
  getPartnerApplySessionState,
  signOutFromPartnerApply,
  submitOrganizationApplication,
} from "@/app/partners/actions";
import type { PartnerApplyFlow } from "@/lib/partners/submit-application";
import {
  ORGANIZATION_INTERESTS,
  ORGANIZATION_PROMOTION_CHANNELS,
  ORGANIZATION_TYPES,
} from "@/lib/partners/organization-types";
import {
  ORGANIZATION_WEBSITE_FIELD_HINT,
  ORGANIZATION_WEBSITE_FIELD_PLACEHOLDER,
} from "@/lib/partners/profile-links";
import {
  PARTNER_APPLY_SUCCESS_CTA_RETURN,
  PARTNER_APPLY_SUCCESS_CTA_STATUS,
  getPartnerApplyStatusCheckHref,
  getPartnerApplySuccessCopy,
} from "@/lib/partners/apply-success-copy";

type AuthUiState =
  | { status: "loading" }
  | { status: "signed_out"; flow: "new_account" }
  | {
      status: "signed_in";
      flow: "existing_account";
      email: string;
      userId: string;
    };

export default function OrganizationPartnerApplyPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [submittedFlow, setSubmittedFlow] =
    useState<PartnerApplyFlow>("new_account");
  const [existingAccount, setExistingAccount] = useState(false);
  const [continueKind, setContinueKind] =
    useState<PartnerExistingAccountContinueKind | null>(null);
  const [authUi, setAuthUi] = useState<AuthUiState>({ status: "loading" });
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "unavailable" | "email"
  >("idle");
  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  const [draftDefaults, setDraftDefaults] = useState<Record<string, string>>({});
  const [draftReady, setDraftReady] = useState(false);
  const [showRestoredBanner, setShowRestoredBanner] = useState(false);
  const [formEpoch, setFormEpoch] = useState(0);
  const [, startTransition] = useTransition();

  function persistDraft(pendingRestore = true) {
    const form = formRef.current;
    if (!form) return;
    const fields = collectPartnerApplicationDraftFields(form, {
      partner_type: "organization",
    });
    savePartnerApplicationDraft({
      fields,
      returnPath: ORGANIZATION_APPLY_LOGIN_NEXT,
      pendingRestore,
    });
  }

  function prepareSignInContinue() {
    const kind = continueKind ?? "existing_account";
    persistDraft(kind === "existing_account");
  }

  function useDifferentEmail() {
    setExistingAccount(false);
    setContinueKind(null);
    setError(null);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.email;
      delete next.username;
      delete next.password;
      return next;
    });
    setDraftDefaults((prev) => {
      const next = { ...prev };
      delete next.email;
      return next;
    });
    setFormEpoch((n) => n + 1);
    window.setTimeout(() => {
      emailInputRef.current?.focus();
    }, 50);
  }

  async function refreshAuthState() {
    setAuthUi({ status: "loading" });
    try {
      const state = await getPartnerApplySessionState();
      if (state.redirectTo) {
        window.location.assign(state.redirectTo);
        return;
      }
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
      setAuthUi({ status: "signed_out", flow: "new_account" });
    }
  }

  useEffect(() => {
    void refreshAuthState();
  }, []);

  useEffect(() => {
    const draft = loadPartnerApplicationDraft();
    if (draft?.fields.partner_type === "organization") {
      setDraftDefaults(draft.fields);
      if (draft.fields.username) setLoginIdentifier(draft.fields.username);
      if (draft.pendingRestore) {
        setShowRestoredBanner(true);
        markPartnerApplicationDraftRestored();
      }
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (authUi.status === "signed_in") return;
    const value = loginIdentifier.trim();
    if (!value) {
      setUsernameStatus("idle");
      setUsernameHint(null);
      return;
    }
    if (looksLikeEmail(value)) {
      setUsernameStatus("email");
      setUsernameHint("Using your email as the login identifier.");
      return;
    }
    setUsernameStatus("checking");
    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const result = await checkPartnerUsernameAvailableAction(value);
        if (result.available) {
          setUsernameStatus("available");
          setUsernameHint("Username is available.");
        } else {
          setUsernameStatus("unavailable");
          setUsernameHint(result.reason ?? "Username unavailable.");
        }
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [loginIdentifier, authUi.status, startTransition]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setExistingAccount(false);
    setContinueKind(null);
    const fd = new FormData(e.currentTarget);
    if (authUi.status === "signed_in") {
      fd.set("email", authUi.email);
      fd.set("username", authUi.email);
      fd.set("password", "");
      fd.set("confirm_password", "");
    }
    const result = await submitOrganizationApplication(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      if (
        result.code === "existing_account" ||
        result.code === "existing_application" ||
        result.code === "existing_partner"
      ) {
        setExistingAccount(true);
        setContinueKind(result.code);
        persistDraft(result.code === "existing_account");
      }
      return;
    }
    clearPartnerApplicationDraft();
    setShowRestoredBanner(false);
    setSubmittedFlow(result.flow);
    setDone(true);
  }

  if (done) {
    const copy = getPartnerApplySuccessCopy(submittedFlow);
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-12">
        <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <JobProofLogo />
          <h1 className="mt-6 text-2xl font-bold text-zinc-950">
            Organization application received
          </h1>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-600">
            {copy.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={getPartnerApplyStatusCheckHref(
                authUi.status === "signed_in"
              )}
              className="inline-flex justify-center rounded-xl bg-[#2436BB] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1c2a96]"
            >
              {PARTNER_APPLY_SUCCESS_CTA_STATUS}
            </Link>
            <Link
              href="/partners/organizations"
              className="inline-flex justify-center rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              {PARTNER_APPLY_SUCCESS_CTA_RETURN}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isGuest = authUi.status === "signed_out";
  const signedInEmail = authUi.status === "signed_in" ? authUi.email : "";

  if (!draftReady) {
    return (
      <div className="min-h-screen bg-white px-6 py-12 text-sm text-zinc-600">
        Loading application…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-200 px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/partners/organizations">
            <JobProofLogo />
          </Link>
          <Link
            href="/partners/organizations"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            ← Organization Partners
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#2436BB]">
          Association & Organization Partners
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">
          Organization Partner application
        </h1>
        <p className="mt-3 text-zinc-600">
          Apply to become an Organization Partner in the JobProof Partner
          Program. Approved Organization Partners earn $150 CAD for each
          qualified contractor referral, subject to the existing qualification
          requirements. This form is for associations, chambers, buying groups,
          and similar organizations.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Looking for the general Partner Program instead?{" "}
          <Link href="/partners/apply" className="font-medium text-[#2436BB] hover:underline">
            Apply as a Creator or Marketing Partner
          </Link>
          .
        </p>

        {showRestoredBanner ? (
          <div
            className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
            role="status"
          >
            Signed in successfully. Your Partner application has been restored.
          </div>
        ) : null}

        {authUi.status === "signed_in" ? (
          <div className="mt-6 rounded-xl border border-[#2436BB]/25 bg-[#2436BB]/5 px-4 py-4 text-sm text-zinc-900">
            <p className="font-semibold text-zinc-950">
              You are signed in as {authUi.email}.
            </p>
            <p className="mt-2 text-zinc-700">
              Your existing JobProof account will be linked to your Partner
              application. You’ll use the same sign-in details to access the
              Partner Portal after approval.
            </p>
            <button
              type="button"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                await signOutFromPartnerApply();
                setSigningOut(false);
                await refreshAuthState();
              }}
              className="mt-3 text-sm font-semibold text-[#2436BB] hover:underline disabled:opacity-60"
            >
              {signingOut
                ? "Signing out…"
                : "Not you? Sign out and use another account."}
            </button>
          </div>
        ) : null}

        {existingAccount && continueKind ? (
          <div className="mt-6">
            <ExistingAccountContinuePanel
              kind={continueKind}
              signInHref={partnerExistingAccountLoginHref(
                continueKind,
                ORGANIZATION_APPLY_LOGIN_NEXT
              )}
              onSignIn={prepareSignInContinue}
              onUseDifferentEmail={useDifferentEmail}
            />
          </div>
        ) : null}

        <form
          key={formEpoch}
          ref={formRef}
          onSubmit={onSubmit}
          className="mt-8 space-y-8"
          noValidate
        >
          <input type="hidden" name="partner_type" value="organization" />
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">Organization</h2>
            <Field
              label="Organization name"
              name="organization_name"
              required
              defaultValue={draftDefaults.organization_name}
              error={fieldErrors.organization_name}
            />
            <div>
              <label className="block text-sm font-medium text-zinc-800">
                Organization type <span className="text-red-600">*</span>
              </label>
              <select
                name="organization_type"
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm"
                defaultValue={draftDefaults.organization_type ?? ""}
              >
                <option value="" disabled>
                  Select type…
                </option>
                {ORGANIZATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {fieldErrors.organization_type ? (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.organization_type}</p>
              ) : null}
            </div>
            <Field
              label="Website"
              name="website"
              inputMode="url"
              placeholder={ORGANIZATION_WEBSITE_FIELD_PLACEHOLDER}
              hint={ORGANIZATION_WEBSITE_FIELD_HINT}
              defaultValue={draftDefaults.website}
              error={fieldErrors.website}
            />
            <Field
              label="Approximate number of members"
              name="member_count"
              defaultValue={draftDefaults.member_count}
              error={fieldErrors.member_count}
            />
            <Field
              label="Primary industries represented"
              name="primary_industries"
              defaultValue={draftDefaults.primary_industries}
              error={fieldErrors.primary_industries}
            />
            <Field
              label="Geographic coverage"
              name="geographic_coverage"
              defaultValue={draftDefaults.geographic_coverage}
              error={fieldErrors.geographic_coverage}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">Primary contact</h2>
            <Field
              label="Primary contact name"
              name="contact_name"
              required
              defaultValue={draftDefaults.contact_name}
              error={fieldErrors.contact_name}
            />
            <Field
              label="Job title"
              name="job_title"
              defaultValue={draftDefaults.job_title}
              error={fieldErrors.job_title}
            />
            {signedInEmail ? (
              <Field
                label="Email"
                name="email"
                type="email"
                required
                error={fieldErrors.email}
                defaultValue={signedInEmail}
                readOnly
              />
            ) : (
              <div>
                <label className="block text-sm font-medium text-zinc-800">
                  Email <span className="text-red-600">*</span>
                </label>
                <input
                  ref={emailInputRef}
                  name="email"
                  type="email"
                  required
                  defaultValue={draftDefaults.email}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm"
                />
                {fieldErrors.email ? (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
                ) : null}
              </div>
            )}
            <Field
              label="Phone"
              name="phone"
              defaultValue={draftDefaults.phone}
              error={fieldErrors.phone}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">Audience (optional)</h2>
            <Field
              label="Newsletter size"
              name="newsletter_size"
              defaultValue={draftDefaults.newsletter_size}
            />
            <Field
              label="Social media audience"
              name="social_audience"
              defaultValue={draftDefaults.social_audience}
            />
            <Field
              label="Website traffic"
              name="website_traffic"
              defaultValue={draftDefaults.website_traffic}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">
              How do you plan to promote JobProof? <span className="text-red-600">*</span>
            </h2>
            {fieldErrors.promotion_channels ? (
              <p className="text-sm text-red-600">{fieldErrors.promotion_channels}</p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {ORGANIZATION_PROMOTION_CHANNELS.map((c) => (
                <label
                  key={c.value}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name={`channel_${c.value}`}
                    className="rounded"
                    defaultChecked={draftDefaults[`channel_${c.value}`] === "on"}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Interested in</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {ORGANIZATION_INTERESTS.map((c) => (
                <label
                  key={c.value}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name={`interest_${c.value}`}
                    className="rounded"
                    defaultChecked={draftDefaults[`interest_${c.value}`] === "on"}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">Additional comments</h2>
            <textarea
              name="additional_comments"
              rows={4}
              defaultValue={draftDefaults.additional_comments}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm"
              placeholder="Anything else we should know?"
            />
          </section>

          {isGuest ? (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-zinc-900">
                Create Partner Portal login
              </h2>
              <div>
                <label className="block text-sm font-medium text-zinc-800">
                  Username or email <span className="text-red-600">*</span>
                </label>
                <input
                  name="username"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm"
                />
                {usernameHint ? (
                  <p
                    className={`mt-1 text-sm ${
                      usernameStatus === "unavailable" ? "text-red-600" : "text-zinc-500"
                    }`}
                  >
                    {usernameHint}
                  </p>
                ) : null}
                {fieldErrors.username ? (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.username}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-800">
                  Password <span className="text-red-600">*</span>
                </label>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={PARTNER_PASSWORD_MIN_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  {partnerPasswordStrengthHint(password)}
                </p>
                {fieldErrors.password ? (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-800">
                  Confirm password <span className="text-red-600">*</span>
                </label>
                <input
                  name="confirm_password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm"
                />
                {fieldErrors.confirm_password ? (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.confirm_password}</p>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                Show passwords
              </label>
            </section>
          ) : (
            <>
              <input type="hidden" name="username" value={signedInEmail} />
              <input type="hidden" name="password" value="" />
              <input type="hidden" name="confirm_password" value="" />
            </>
          )}

          <label className="flex items-start gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              name="agreement_accepted"
              required
              className="mt-1 rounded"
            />
            <span>
              I accept the{" "}
              <Link
                href={PARTNER_AGREEMENT_PATH}
                className="font-medium text-[#2436BB] hover:underline"
                target="_blank"
              >
                Partner Program Agreement
              </Link>
              .
            </span>
          </label>
          {fieldErrors.agreement_accepted ? (
            <p className="text-sm text-red-600">{fieldErrors.agreement_accepted}</p>
          ) : null}

          {/* Honeypot */}
          <input
            type="text"
            name="company_website"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden
          />

          {error && !existingAccount ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || authUi.status === "loading"}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#2436BB] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1c2a96] disabled:opacity-60 sm:w-auto"
          >
            {loading ? "Submitting…" : "Submit organization application"}
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  inputMode,
  required,
  error,
  hint,
  placeholder,
  defaultValue,
  readOnly,
}: {
  label: string;
  name: string;
  type?: string;
  inputMode?: "url";
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  defaultValue?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-800" htmlFor={name}>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        readOnly={readOnly}
        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm read-only:bg-zinc-50"
      />
      {hint && !error ? (
        <p className="mt-1 text-xs text-zinc-500">{hint}</p>
      ) : null}
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
