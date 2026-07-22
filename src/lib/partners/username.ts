/** Partner username / login-identifier validation and reserved-name rules. */

export const PARTNER_USERNAME_MIN_LENGTH = 4;
export const PARTNER_USERNAME_MAX_LENGTH = 30;
/** Matches existing JobProof signup client policy. */
export const PARTNER_PASSWORD_MIN_LENGTH = 6;

export const RESERVED_PARTNER_USERNAMES = [
  "admin",
  "administrator",
  "support",
  "jobproof",
  "partner",
  "partners",
  "login",
  "signup",
  "account",
  "billing",
  "api",
  "www",
  "root",
  "system",
] as const;

const USERNAME_RE = /^[a-z0-9][a-z0-9._]*$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePartnerUsername(raw: string): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function looksLikeEmail(value: string): boolean {
  return String(value ?? "").includes("@");
}

export function validatePartnerUsername(
  raw: string
): { ok: true; username: string; normalized: string } | { ok: false; error: string } {
  const username = String(raw ?? "").trim();
  if (!username) {
    return { ok: false, error: "Username is required." };
  }
  if (
    username.length < PARTNER_USERNAME_MIN_LENGTH ||
    username.length > PARTNER_USERNAME_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: `Username must be ${PARTNER_USERNAME_MIN_LENGTH}–${PARTNER_USERNAME_MAX_LENGTH} characters.`,
    };
  }
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error:
        "Username may only contain letters, numbers, underscores, and periods, and must start with a letter or number.",
    };
  }
  const normalized = normalizePartnerUsername(username);
  if (
    (RESERVED_PARTNER_USERNAMES as readonly string[]).includes(normalized)
  ) {
    return { ok: false, error: "That username is reserved. Please choose another." };
  }
  return { ok: true, username, normalized };
}

/**
 * Account login identifier: either a partner username or an email address.
 * Email logins use Supabase Auth email sign-in (no username registry claim).
 */
export function validatePartnerLoginIdentifier(
  raw: string,
  options?: { applicationEmail?: string }
):
  | {
      ok: true;
      kind: "username";
      username: string;
      normalized: string;
    }
  | {
      ok: true;
      kind: "email";
      email: string;
    }
  | { ok: false; error: string } {
  const value = String(raw ?? "").trim();
  if (!value) {
    return { ok: false, error: "Enter a username or email address." };
  }

  if (looksLikeEmail(value)) {
    const email = value.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    const applicationEmail = options?.applicationEmail?.trim().toLowerCase();
    if (applicationEmail && email !== applicationEmail) {
      return {
        ok: false,
        error:
          "When using email to sign in, it must match the email on this application.",
      };
    }
    return { ok: true, kind: "email", email };
  }

  const usernameResult = validatePartnerUsername(value);
  if (!usernameResult.ok) return usernameResult;
  return {
    ok: true,
    kind: "username",
    username: usernameResult.username,
    normalized: usernameResult.normalized,
  };
}

export function validatePartnerPassword(
  password: string,
  confirmPassword: string
): string | null {
  if (!password) return "Password is required.";
  if (password.length < PARTNER_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PARTNER_PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password !== confirmPassword) {
    return "Password and confirmation do not match.";
  }
  return null;
}

/** Client-side password strength hint (does not replace confirm check). */
export function partnerPasswordStrengthHint(password: string): string | null {
  if (!password) return null;
  if (password.length < PARTNER_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PARTNER_PASSWORD_MIN_LENGTH} characters.`;
  }
  return null;
}
