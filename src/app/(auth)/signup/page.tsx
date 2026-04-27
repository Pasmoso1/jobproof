"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  HEARD_ABOUT_SOURCE_OPTIONS,
  captureFirstTouchIfMissing,
  persistHeardAboutSourceClient,
} from "@/lib/attribution-first-touch";

type PostSubmitView =
  | null
  | "new_user_check_email"
  | "existing_neutral"
  | "existing_explicit_unconfirmed";

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
  const [heardAboutSource, setHeardAboutSource] = useState("");
  const router = useRouter();

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
      return;
    }
    setLoading(true);
    captureFirstTouchIfMissing(
      `${window.location.pathname}${window.location.search || ""}`
    );
    persistHeardAboutSourceClient(heardAboutSource);

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
          return;
        }
        setPostSubmitView(
          branch === "explicit_unconfirmed"
            ? "existing_explicit_unconfirmed"
            : "existing_neutral"
        );
        return;
      }
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      setLoading(false);
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
            <img
              src="/jobproof-logo.png"
              alt="Job Proof"
              className="mx-auto h-10 w-auto"
            />
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
            <img
              src="/jobproof-logo.png"
              alt="Job Proof"
              className="mx-auto h-10 w-auto"
            />
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
            <img
              src="/jobproof-logo.png"
              alt="Job Proof"
              className="mx-auto h-10 w-auto"
            />
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center">
          <img
            src="/jobproof-logo.png"
            alt="Job Proof"
            className="mx-auto h-10 w-auto"
          />
        </Link>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">Create account</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Sign up to start protecting your jobs.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              />
            </div>

            <div>
              <label
                htmlFor="heardAboutSource"
                className="block text-sm font-medium text-zinc-700"
              >
                How did you hear about JobProof?{" "}
                <span className="text-zinc-400">(optional)</span>
              </label>
              <select
                id="heardAboutSource"
                value={heardAboutSource}
                onChange={(e) => setHeardAboutSource(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              >
                <option value="">Select one</option>
                {HEARD_ABOUT_SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
                    setPassword(e.target.value);
                    setPasswordMismatch(false);
                  }}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 pr-10 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
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
                    setConfirmPassword(e.target.value);
                    setPasswordMismatch(false);
                  }}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 pr-10 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
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
              className="w-full rounded-lg bg-[#2436BB] px-4 py-3 font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Creating account..." : "Create account"}
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
