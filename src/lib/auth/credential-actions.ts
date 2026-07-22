"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveAppUrl } from "@/lib/stripe";
import {
  looksLikeEmail,
  normalizePartnerUsername,
} from "@/lib/partners/username";
import { resolveEmailForPartnerUsername } from "@/lib/partners/auth-account";

const GENERIC_LOGIN_ERROR =
  "We couldn't sign you in. Check your username or email and password, then try again.";

const GENERIC_RESET_MESSAGE =
  "If an account exists for that username or email, we sent a password reset link.";

/**
 * Sign in with username or email. Username→email resolution stays server-side
 * and is never returned to the client.
 */
export async function signInWithUsernameOrEmail(input: {
  identifier: string;
  password: string;
}): Promise<
  | { ok: true }
  | { ok: false; error: string; unconfirmed?: boolean }
> {
  const identifier = String(input.identifier ?? "").trim();
  const password = String(input.password ?? "");
  if (!identifier || !password) {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  let email = identifier;
  if (!looksLikeEmail(identifier)) {
    const resolved = await resolveEmailForPartnerUsername(
      normalizePartnerUsername(identifier)
    );
    if (!resolved) {
      // Generic failure — do not reveal whether the username exists.
      return { ok: false, error: GENERIC_LOGIN_ERROR };
    }
    email = resolved;
  } else {
    email = identifier.trim().toLowerCase();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
      return {
        ok: false,
        error:
          "Your email address has not been confirmed yet. Please check your inbox and click the confirmation link.",
        unconfirmed: true,
      };
    }
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  return { ok: true };
}

/**
 * Password recovery for username or email. Always returns a generic success
 * message; never reveals whether the account exists or the resolved email.
 */
export async function requestPasswordResetForUsernameOrEmail(input: {
  identifier: string;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const identifier = String(input.identifier ?? "").trim();
  if (!identifier) {
    return { ok: true, message: GENERIC_RESET_MESSAGE };
  }

  let email: string | null = null;
  if (looksLikeEmail(identifier)) {
    email = identifier.trim().toLowerCase();
  } else {
    email = await resolveEmailForPartnerUsername(
      normalizePartnerUsername(identifier)
    );
  }

  if (email) {
    const supabase = await createClient();
    const redirectTo = `${resolveAppUrl()}/auth/callback?next=${encodeURIComponent("/update-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) {
      console.error("[auth] password reset send failed", {
        message: error.message,
      });
    }
  }

  return { ok: true, message: GENERIC_RESET_MESSAGE };
}

/** Resend signup confirmation without revealing account existence details. */
export async function resendSignupConfirmation(input: {
  identifier: string;
}): Promise<{ ok: true; message: string }> {
  const identifier = String(input.identifier ?? "").trim();
  let email: string | null = null;
  if (looksLikeEmail(identifier)) {
    email = identifier.toLowerCase();
  } else if (identifier) {
    email = await resolveEmailForPartnerUsername(
      normalizePartnerUsername(identifier)
    );
  }
  if (email) {
    const supabase = await createClient();
    await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${resolveAppUrl()}/auth/callback?next=${encodeURIComponent("/partner/status")}`,
      },
    });
  }
  return {
    ok: true,
    message:
      "If that account needs verification, we sent a confirmation email.",
  };
}
