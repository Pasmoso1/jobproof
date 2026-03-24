"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const [authError, setAuthError] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "auth") {
      setAuthError(true);
      router.replace("/login", { scroll: false });
    }
    if (searchParams.get("confirmed") === "true") {
      setConfirmed(true);
      router.replace("/login", { scroll: false });
    }
  }, [searchParams, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAuthError(false);
    setConfirmed(false);
    setUnconfirmedEmail(null);
    setResendSuccess(false);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      const msg = signInError.message;
      if (
        msg.toLowerCase().includes("email not confirmed") ||
        msg.toLowerCase().includes("email_not_confirmed")
      ) {
        setUnconfirmedEmail(email);
        setError(
          "Your email address has not been confirmed yet. Please check your inbox and click the confirmation link."
        );
      } else if (
        msg.toLowerCase().includes("invalid login credentials") ||
        msg.toLowerCase().includes("invalid_credentials")
      ) {
        setError(
          "We couldn't sign you in. Check your email and password, or create an account if you're new to JobProof."
        );
      } else {
        setError(msg);
      }
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  async function handleResendConfirmation() {
    if (!unconfirmedEmail) return;
    setResendLoading(true);
    setResendSuccess(false);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: unconfirmedEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/login` },
    });

    setResendLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setResendSuccess(true);
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
          <h1 className="text-xl font-semibold text-zinc-900">Sign in</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Enter your email and password to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {confirmed && (
              <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
                Your email has been confirmed. You can now sign in.
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
                {unconfirmedEmail && (
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
                        We sent a new confirmation email. Please check your inbox and spam folder.
                      </p>
                    )}
                  </div>
                )}
              </div>
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
              {" · "}
              <Link href="/signup" className="font-medium text-[#2436BB] hover:underline">
                Create account
              </Link>
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-600">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-[#2436BB] hover:underline">
              Sign up
            </Link>
          </p>
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
