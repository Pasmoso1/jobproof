"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user) {
        setRecoveryMode(true);
        setReady(true);
      }
    }

    void checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
      if (session?.user) {
        setReady(true);
      }
    });

    const timer = setTimeout(() => {
      if (cancelled) return;
      setReady(true);
      void supabase.auth.getUser().then(({ data: { user } }) => {
        if (cancelled) return;
        if (!user) setInvalidLink(true);
      });
    }, 2000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setLoading(false);
      setError("Your session expired. Please open the reset link from your email again.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.replace("/login?passwordUpdated=true");
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-center text-zinc-600">Loading...</p>
            <p className="mt-2 text-center text-sm text-zinc-500">
              If you clicked a password reset link, we&apos;re verifying it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (invalidLink) {
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
            <h1 className="text-xl font-semibold text-zinc-900">Invalid or expired link</h1>
            <p className="mt-3 text-sm text-zinc-600">
              This password reset link is invalid or has expired. Request a new one below.
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 block w-full rounded-lg bg-[#2436BB] px-4 py-3 text-center text-sm font-medium text-white hover:bg-[#1c2a96]"
            >
              Request new reset link
            </Link>
            <Link
              href="/login"
              className="mt-3 block w-full text-center text-sm font-medium text-[#2436BB] hover:underline"
            >
              Back to sign in
            </Link>
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
          <h1 className="text-xl font-semibold text-zinc-900">
            {recoveryMode ? "Set new password" : "Update password"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700"
              >
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              />
              <p className="mt-1 text-xs text-zinc-500">At least 6 characters</p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-zinc-700"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-1 focus:ring-[#2436BB]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#2436BB] px-4 py-3 font-medium text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus:ring-2 focus:ring-[#2436BB] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-600">
            <Link href="/login" className="font-medium text-[#2436BB] hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
