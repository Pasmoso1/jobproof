"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";
import { LandingIcon } from "@/components/landing/landing-icon";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { captureFirstTouchIfMissing } from "@/lib/attribution-first-touch";
import {
  normalizeStoredPartnerRef,
  readPartnerRefClient,
} from "@/lib/partners/partner-ref-cookie";
import { applyPartnerReferralAttributionFromSession } from "@/app/(auth)/signup/actions";
import {
  trackSignupError,
  trackSignupStart,
  trackSignupSubmit,
  trackSignupSuccess,
  trackSignupView,
} from "@/lib/signup-funnel-analytics";

type PostSubmitView =
  | null
  | "new_user_check_email"
  | "existing_neutral"
  | "existing_explicit_unconfirmed";

const TRIAL_REASSURANCE = [
  "14 days free",
  "No credit card required",
  "Cancel anytime during your trial",
] as const;

function logSignupDebug(label: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.info("[JobProof signup debug]", label, payload);
  }
}

function isEmailAlreadyRegisteredError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("user already") ||
    m.includes("email address is already") ||
    m.includes("duplicate")
  );
}

/** Only true when Supabase sign-in response clearly indicates unconfirmed email (no fuzzy "not confirmed" heuristics). */
function isExplicitUnconfirmedSignInError(err: {
  message: string;
  code?: string;
}): boolean {
  const code = (err.code ?? "").toLowerCase();
  if (code === "email_not_confirmed") return true;
  const m = err.message.toLowerCase();
  return (
    m.includes("email not confirmed") || m.includes("email_not_confirmed")
  );
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [postSubmitView, setPostSubmitView] = useState<PostSubmitView>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [hasPartnerReferralContext, setHasPartnerReferralContext] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fromQuery = normalizeStoredPartnerRef(
      new URLSearchParams(window.location.search).get("ref")
    );
    const fromStored = normalizeStoredPartnerRef(readPartnerRefClient());
    const nextValue = Boolean(fromQuery || fromStored);
    const frame = window.requestAnimationFrame(() => {
      setHasPartnerReferralContext(nextValue);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    trackSignupView();
  }, []);

  function markSignupStarted() {
    trackSignupStart();
  }

  async function branchExistingEmail(
    supabase: ReturnType<typeof createClient>
  ): Promise<"signed_in" | "explicit_unconfirmed" | "neutral"> {
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    const errPayload = signInError
      ? {
          message: signInError.message,
          code:
            "code" in signInError
              ? String((signInError as { code?: string }).code ?? "")
              : "",
          status: signInError.status ?? null,
        }
      : null;

    logSignupDebug("branchExistingEmail signInWithPassword", {
      hasSession: !!signInData?.session,
      signInError: errPayload,
    });

    if (!signInError && signInData.session) {
      // Existing JobProof account — do not apply Partner cookie attribution.
      router.push("/dashboard");
      router.refresh();
      return "signed_in";
    }

    if (
      signInError &&
      isExplicitUnconfirmedSignInError({
        message: signInError.message,
        code:
          "code" in signInError
            ? (signInError as { code?: string }).code
            : undefined,
      })
    ) {
      logSignupDebug("branchExistingEmail outcome", {
        outcome: "explicit_unconfirmed",
      });
      return "explicit_unconfirmed";
    }

    logSignupDebug("branchExistingEmail outcome", {
      outcome: "neutral_existing_email",
    });
    return "neutral";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPasswordMismatch(false);
    setPostSubmitView(null);
    setResendSuccess(false);
    if (password !== confirmPassword) {
      setPasswordMismatch(true);
      trackSignupError({ kind: "password_mismatch" });
      return;
    }
    trackSignupSubmit();
    setLoading(true);
    captureFirstTouchIfMissing(
      `${window.location.pathname}${window.location.search || ""}`
    );

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/login`,
      },
    });

    logSignupDebug("signUp response", {
      error: signUpError?.message ?? null,
      errorStatus: signUpError?.status ?? null,
      hasUser: !!data?.user,
      identitiesLength: data?.user?.identities?.length ?? null,
      identities: data?.user?.identities,
      hasSession: !!data?.session,
    });

    if (signUpError) {
      setLoading(false);
      if (isEmailAlreadyRegisteredError(signUpError.message)) {
        const branch = await branchExistingEmail(supabase);
        if (branch === "signed_in") {
          trackSignupError({ kind: "existing_account" });
          return;
        }
        trackSignupError({ kind: "existing_account" });
        setPostSubmitView(
          branch === "explicit_unconfirmed"
            ? "existing_explicit_unconfirmed"
            : "existing_neutral"
        );
        return;
      }
      trackSignupError({
        message: signUpError.message,
        code:
          "code" in signUpError
            ? String((signUpError as { code?: string }).code ?? "")
            : null,
      });
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      setLoading(false);
      trackSignupSuccess({ requiresEmailVerification: false });
      try {
        await applyPartnerReferralAttributionFromSession();
      } catch (err) {
        console.error("[signup] partner attribution", err);
      }
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const user = data.user;
    const identities = user?.identities;
    const duplicateByIdentities =
      !!user && Array.isArray(identities) && identities.length === 0;

    if (duplicateByIdentities) {
      logSignupDebug("duplicate email: empty identities array", {
        userId: user?.id,
      });
      const branch = await branchExistingEmail(supabase);
      setLoading(false);
      trackSignupError({ kind: "existing_account" });
      if (branch === "signed_in") {
        return;
      }
      setPostSubmitView(
        branch === "explicit_unconfirmed"
          ? "existing_explicit_unconfirmed"
          : "existing_neutral"
      );
      return;
    }

    setLoading(false);
    trackSignupSuccess({ requiresEmailVerification: true });
    setPostSubmitView("new_user_check_email");
  }

  async function handleResend() {
    setResendLoading(true);
    setResendSuccess(false);
    setError(null);

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/login`,
      },
    });

    logSignupDebug("resend", {
      error: resendError?.message ?? null,
    });

    setResendLoading(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setResendSuccess(true);
  }

  if (postSubmitView === "existing_neutral") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 block text-center">
            <JobProofLogo className="mx-auto h-10 w-auto" />
          </Link>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-zinc-900">
              This email is already registered
            </h1>
            <p className="mt-3 text-sm text-zinc-600">
              This email is already registered with JobProof. Sign in with your
              password, resend the confirmation email, or reset your password if
              needed.
            </p>

            {error && (
              <p
                className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}

            {resendSuccess && (
              <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                We sent a new confirmation email. Please check your inbox and spam
                folder.
              </p>
            )}

            <div className="mt-6 space-y-3">
              <Link
                href="/login"
                className="block w-full rounded-lg bg-[#2436BB] px-4 py-3 text-center text-sm font-medium text-white hover:bg-[#1c2a96]"
              >
                Sign in
              </Link>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-70"
              >
                {resendLoading ? "Sending..." : "Resend confirmation email"}
              </button>
              <Link
                href="/forgot-password"
                className="block w-full rounded-lg border border-zinc-300 px-4 py-3 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Forgot password
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (postSubmitView === "existing_explicit_unconfirmed") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 block text-center">
            <JobProofLogo className="mx-auto h-10 w-auto" />
          </Link>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-zinc-900">
              Email not confirmed yet
            </h1>
            <p className="mt-3 text-sm text-zinc-600">
              This email is registered but hasn&apos;t been confirmed yet. Check
              your inbox for the confirmation link, or resend the email. You can
              sign in after confirming, or reset your password if needed.
            </p>

            {error && (
              <p
                className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}

            {resendSuccess && (
              <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                We sent a new confirmation email. Please check your inbox and spam
                folder.
              </p>
            )}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                className="w-full rounded-lg bg-[#2436BB] px-4 py-3 text-sm font-medium text-white hover:bg-[#1c2a96] disabled:opacity-70"
              >
                {resendLoading ? "Sending..." : "Resend confirmation email"}
              </button>
              <Link
                href="/login"
                className="block w-full rounded-lg border border-zinc-300 px-4 py-3 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Sign in
              </Link>
              <Link
                href="/forgot-password"
                className="block w-full rounded-lg border border-zinc-300 px-4 py-3 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Forgot password
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (postSubmitView === "new_user_check_email") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 block text-center">
            <JobProofLogo className="mx-auto h-10 w-auto" />
          </Link>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-zinc-900">Check your email</h1>
            <p className="mt-3 text-sm text-zinc-600">
              We&apos;ve sent a confirmation link to <strong>{email}</strong>.
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              You must confirm your email before you can sign in. Click the link
              in the email to activate your account.
            </p>

            {error && (
              <p
                className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}

            {resendSuccess && (
              <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                We sent a new confirmation email. Please check your inbox and spam
                folder.
              </p>
            )}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-70"
              >
                {resendLoading ? "Sending..." : "Resend confirmation email"}
              </button>
              <Link
                href="/login"
                className="block w-full rounded-lg bg-[#2436BB] px-4 py-3 text-center text-sm font-medium text-white hover:bg-[#1c2a96]"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-6 sm:justify-center sm:py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-5 block text-center sm:mb-8">
          <JobProofLogo className="mx-auto h-10 w-auto" />
        </Link>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Start your 14-day free trial
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Create your JobProof account and start turning more inquiries into
            paying jobs.
          </p>
          <ul
            aria-label="Free trial details"
            className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-medium text-zinc-700"
          >
            {TRIAL_REASSURANCE.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <LandingIcon
                  name="checkCircle"
                  className="h-4 w-4 shrink-0 text-[#2436BB]"
                />
                {item}
              </li>
            ))}
          </ul>
          {hasPartnerReferralContext ? (
            <div className="mt-4 rounded-xl border border-[#2436BB]/20 bg-[#2436BB]/5 p-4">
              <p className="text-sm font-semibold text-[#2436BB]">
                Win more work. Manage every job. Get paid.
              </p>
              <p className="mt-2 text-sm text-zinc-700">
                JobProof gives contractors one place to manage the journey from
                quote request through quotes, contracts, changes, and invoicing.
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                You&apos;re continuing from a JobProof partner referral.
              </p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <p
                className="break-words rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  markSignupStarted();
                  setEmail(e.target.value);
                }}
                placeholder="you@example.com"
                autoComplete="email"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => {
                    markSignupStarted();
                    setPassword(e.target.value);
                    setPasswordMismatch(false);
                  }}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 pr-11 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-2.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-zinc-500">At least 6 characters</p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-zinc-700"
              >
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    markSignupStarted();
                    setConfirmPassword(e.target.value);
                    setPasswordMismatch(false);
                  }}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 pr-11 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-2.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordMismatch && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  Passwords do not match.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#2436BB] px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Creating account..." : "Start My Free Trial"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-600">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[#2436BB] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
