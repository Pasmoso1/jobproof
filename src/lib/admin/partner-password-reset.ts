import { createClient } from "@supabase/supabase-js";

/**
 * Admin-triggered partner password reset.
 *
 * Delivery uses Supabase Auth's own recovery email (`resetPasswordForEmail`), the same
 * mechanism as the public "Forgot password" flow, so the message goes through the
 * configured Auth SMTP/template and the link is a single-use token that expires on
 * Supabase's recovery OTP expiry (Auth settings; default 1 hour).
 *
 * `auth.admin.generateLink({ type: "recovery" })` must NOT be used for this: it only
 * returns a link and sends nothing. The previous implementation did exactly that, discarded
 * the link, and still reported success.
 */

export type RecoverySendError = {
  message?: string | null;
  code?: string | null;
  status?: number | null;
};

export type RecoverySender = (
  email: string,
  redirectTo: string
) => Promise<{ error: RecoverySendError | null }>;

export type PasswordResetResult = { ok: true } | { ok: false; error: string };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Builds the post-reset redirect from the server-configured app URL only (never from
 * request input), so reset links cannot be pointed at an untrusted domain. Only the
 * origin is used; credentials, paths and query strings in the configured value are dropped.
 */
export function resolvePasswordResetRedirectTo(
  appUrl: string | null | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV
): { ok: true; redirectTo: string } | { ok: false; error: string } {
  const raw = String(appUrl ?? "").trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: "The app URL is not configured correctly, so no email was sent." };
  }
  const isLocal = LOCAL_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocal)) {
    return { ok: false, error: "The app URL must use https, so no email was sent." };
  }
  if (isLocal && nodeEnv === "production") {
    return {
      ok: false,
      error: "The app URL points at localhost in production, so no email was sent.",
    };
  }
  const next = encodeURIComponent("/update-password");
  return { ok: true, redirectTo: `${parsed.origin}/auth/callback?next=${next}` };
}

/** Strips URLs/tokens and clamps length so provider errors are safe to show an admin. */
export function sanitizeDeliveryError(error: RecoverySendError | null | undefined): string {
  const code = String(error?.code ?? "").toLowerCase();
  if (code === "over_email_send_rate_limit" || error?.status === 429) {
    return "Email sending is rate-limited right now. Wait a minute and try again.";
  }
  const cleaned = String(error?.message ?? "")
    .replace(/https?:\/\/\S+/gi, "[link removed]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[removed]")
    .trim()
    .slice(0, 160);
  return cleaned
    ? `The password-reset email could not be sent: ${cleaned}`
    : "The password-reset email could not be sent. Try again shortly.";
}

/** Sends the reset email; reports success only when the delivery request itself succeeds. */
export async function deliverPartnerPasswordReset(input: {
  email: string;
  appUrl: string | null | undefined;
  send: RecoverySender;
  nodeEnv?: string;
}): Promise<PasswordResetResult> {
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "This partner has no valid email address on file." };
  }
  const target = resolvePasswordResetRedirectTo(input.appUrl, input.nodeEnv);
  if (!target.ok) return target;

  try {
    const { error } = await input.send(email, target.redirectTo);
    if (error) return { ok: false, error: sanitizeDeliveryError(error) };
  } catch {
    return { ok: false, error: "The password-reset email could not be sent. Try again shortly." };
  }
  return { ok: true };
}

type ListUsersPage = {
  users: Array<{ id: string; email?: string | null }>;
};

/**
 * Bounded lookup of an Auth user by email (the admin API has no email filter).
 * Used only for legacy applications that have no linked `auth_user_id`, so we never
 * claim a reset email was sent to an address with no account behind it.
 */
export async function findAuthUserByEmail(
  listUsers: (page: number, perPage: number) => Promise<{ data: ListUsersPage | null; error: unknown }>,
  email: string,
  options: { perPage?: number; maxPages?: number } = {}
): Promise<{ id: string; email: string } | null> {
  const wanted = String(email ?? "").trim().toLowerCase();
  if (!wanted) return null;
  const perPage = options.perPage ?? 200;
  const maxPages = options.maxPages ?? 50;
  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await listUsers(page, perPage);
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => String(u.email ?? "").trim().toLowerCase() === wanted);
    if (hit) return { id: hit.id, email: wanted };
    if (data.users.length < perPage) return null;
  }
  return null;
}

/**
 * Stateless anon-key sender: no cookies, no session persistence, so nothing is written to
 * the admin's browser and the service-role key is never involved in the delivery request.
 */
export function createRecoveryEmailSender(): RecoverySender | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return async (email, redirectTo) => {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error ? { message: error.message, code: error.code, status: error.status } : null };
  };
}
