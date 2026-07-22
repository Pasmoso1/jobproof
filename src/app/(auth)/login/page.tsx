"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  resendSignupConfirmation,
  signInWithUsernameOrEmail,
} from "@/lib/auth/credential-actions";

function readLoginFlashFromLocation(): {
  authError: boolean;
  resetLinkError: boolean;
  confirmed: boolean;
  passwordUpdated: boolean;
} {
  if (typeof window === "undefined") {
    return { authError: false, resetLinkError: false, confirmed: false, passwordUpdated: false };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    authError: params.get("error") === "auth",
    resetLinkError: params.get("error") === "reset_link",
    confirmed: params.get("confirmed") === "true",
    passwordUpdated: params.get("passwordUpdated") === "true",
  };
}

function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unconfirmedIdentifier, setUnconfirmedIdentifier] = useState<string | null>(
    null
  );
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("next") ?? searchParams.get("redirect");
  const redirectTo = redirectParam ?? "/dashboard";
  const isAdminLogin = redirectParam === "/admin";
  const [authError, setAuthError] = useState(() => readLoginFlashFromLocation().authError);
  const [resetLinkError, setResetLinkError] = useState(
    () => readLoginFlashFromLocation().resetLinkError
  );
  const [confirmed, setConfirmed] = useState(() => readLoginFlashFromLocation().confirmed);
  const [passwordUpdated, setPasswordUpdated] = useState(
    () => readLoginFlashFromLocation().passwordUpdated
  );

  useEffect(() => {
    const flash = readLoginFlashFromLocation();
    if (flash.authError || flash.resetLinkError || flash.confirmed || flash.passwordUpdated) {
      router.replace("/login", { scroll: false });
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAuthError(false);
    setResetLinkError(false);
    setConfirmed(false);
    setPasswordUpdated(false);
    setUnconfirmedIdentifier(null);
    setResendSuccess(false);
    setLoading(true);

    // Admin login stays email-only via direct Supabase for clarity.
    if (isAdminLogin) {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: identifier.trim().toLowerCase(),
        password,
      });
      setLoading(false);
      if (signInError) {
        setError(
          "We couldn't sign you in. Use the email and password for an approved admin account, or reset your password."
        );
        return;
      }
      router.push(redirectTo);
      router.refresh();
      return;
    }

    const result = await signInWithUsernameOrEmail({
      identifier,
      password,
    });
    setLoading(false);

    if (!result.ok) {
      if (result.unconfirmed) {
        setUnconfirmedIdentifier(identifier.trim());
      }
      setError(result.error);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  async function handleResendConfirmation() {
    if (!unconfirmedIdentifier) return;
    setResendLoading(true);
    setResendSuccess(false);
    setError(null);

    await resendSignupConfirmation({ identifier: unconfirmedIdentifier });
    setResendLoading(false);
    setResendSuccess(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center">
          <JobProofLogo className="mx-auto h-10 w-auto" />
        </Link>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">
            {isAdminLogin ? "Admin sign in" : "Sign in"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isAdminLogin
              ? "Sign in with an approved admin account."
              : "Enter your username or email and password to continue."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {confirmed && (
              <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
                Your email has been confirmed. You can now sign in.
              </div>
            )}
            {passwordUpdated && (
              <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
                Your password was updated. Sign in with your new password.
              </div>
            )}
            {resetLinkError && (
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This link is no longer valid. Please request a new password reset email.
              </div>
            )}
            {authError && (
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                The confirmation or reset link was invalid or has expired. Please try again or request a new link.
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
                {unconfirmedIdentifier && (
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={resendLoading}
                      className="block text-sm font-medium text-red-800 underline hover:no-underline disabled:opacity-70"
                    >
                      {resendLoading ? "Sending..." : "Resend confirmation email"}
                    </button>
                    {resendSuccess && (
                      <p className="text-sm text-green-700">
                        If that account needs verification, we sent a confirmation email.
                        Check your inbox and spam folder.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="identifier"
                className="block text-sm font-medium text-zinc-700"
              >
                {isAdminLogin ? "Email" : "Username or email"}
              </label>
              <input
                id="identifier"
                type={isAdminLogin ? "email" : "text"}
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={isAdminLogin ? "you@example.com" : "username or you@example.com"}
                autoComplete={isAdminLogin ? "email" : "username"}
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
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              />
              <p className="mt-1">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-[#2436BB] hover:underline"
                >
                  Forgot your password?
                </Link>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#2436BB] px-4 py-3 font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <p className="mt-4 text-center text-sm text-zinc-600">
              <Link href="/forgot-password" className="font-medium text-[#2436BB] hover:underline">
                Forgot password?
              </Link>
              {!isAdminLogin && (
                <>
                  {" · "}
                  <Link href="/signup" className="font-medium text-[#2436BB] hover:underline">
                    Create account
                  </Link>
                </>
              )}
            </p>
          </form>

          {!isAdminLogin && (
            <p className="mt-6 text-center text-sm text-zinc-600">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-[#2436BB] hover:underline">
                Sign up
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50">
          <div className="text-zinc-500">Loading...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
