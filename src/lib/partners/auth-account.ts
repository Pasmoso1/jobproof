import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveAppUrl } from "@/lib/stripe";
import {
  looksLikeEmail,
  normalizePartnerUsername,
  validatePartnerUsername,
} from "@/lib/partners/username";

export type UsernameAvailability = {
  available: boolean;
  reason?: "invalid" | "reserved" | "taken" | "ok" | "email";
};

export async function checkPartnerUsernameAvailability(
  rawUsername: string
): Promise<UsernameAvailability> {
  const trimmed = String(rawUsername ?? "").trim();
  if (looksLikeEmail(trimmed)) {
    // Email login identifiers are not claimed in the username registry.
    return { available: true, reason: "email" };
  }

  const validated = validatePartnerUsername(trimmed);
  if (!validated.ok) {
    return {
      available: false,
      reason: validated.error.toLowerCase().includes("reserved")
        ? "reserved"
        : "invalid",
    };
  }

  const admin = createServiceRoleClient();
  if (!admin) return { available: false, reason: "invalid" };

  const { data } = await admin
    .from("partner_username_registry")
    .select("normalized_username")
    .eq("normalized_username", validated.normalized)
    .maybeSingle();

  if (data) return { available: false, reason: "taken" };
  return { available: true, reason: "ok" };
}

/** Service-role only. Never return the email to browsers. */
export async function resolveEmailForPartnerUsername(
  rawUsername: string
): Promise<string | null> {
  const normalized = normalizePartnerUsername(rawUsername);
  if (!normalized) return null;
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data: registry } = await admin
    .from("partner_username_registry")
    .select("auth_user_id")
    .eq("normalized_username", normalized)
    .maybeSingle();

  if (registry?.auth_user_id) {
    const { data: userData, error } = await admin.auth.admin.getUserById(
      String(registry.auth_user_id)
    );
    if (!error && userData.user?.email) {
      return userData.user.email.trim().toLowerCase();
    }
  }

  const { data: partner } = await admin
    .from("partners")
    .select("email")
    .eq("normalized_username", normalized)
    .maybeSingle();
  if (partner?.email) return String(partner.email).trim().toLowerCase();

  const { data: application } = await admin
    .from("partner_applications")
    .select("email")
    .eq("normalized_username", normalized)
    .maybeSingle();
  if (application?.email) return String(application.email).trim().toLowerCase();

  return null;
}

export async function claimPartnerUsername(input: {
  admin: SupabaseClient;
  username: string;
  normalized: string;
  authUserId: string;
  applicationId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const { error } = await input.admin.from("partner_username_registry").insert({
    username: input.username,
    normalized_username: input.normalized,
    auth_user_id: input.authUserId,
    application_id: input.applicationId ?? null,
  });
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "That username is already taken.",
        code: "23505",
      };
    }
    return { ok: false, error: error.message, code: error.code };
  }
  return { ok: true };
}

export async function releasePartnerUsernameClaim(
  admin: SupabaseClient,
  normalized: string
): Promise<void> {
  await admin
    .from("partner_username_registry")
    .delete()
    .eq("normalized_username", normalized);
}

export async function linkRegistryApplicationId(
  admin: SupabaseClient,
  normalized: string,
  applicationId: string
): Promise<void> {
  await admin
    .from("partner_username_registry")
    .update({ application_id: applicationId })
    .eq("normalized_username", normalized);
}

/**
 * Create Auth user via signUp so Supabase sends the confirmation email.
 * Passwords are never written to application tables.
 */
export async function createPartnerAuthUserViaSignUp(input: {
  authClient: SupabaseClient;
  email: string;
  password: string;
  username: string;
}): Promise<
  | { ok: true; userId: string; emailConfirmedAt: string | null }
  | { ok: false; error: string; code?: string; existingAccount?: boolean }
> {
  const redirectTo = `${resolveAppUrl()}/auth/callback?next=${encodeURIComponent("/partner/status")}`;
  const { data, error } = await input.authClient.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        partner_username: input.username,
        account_purpose: "partner_application",
      },
    },
  });

  if (error) {
    const existing = isEmailAlreadyRegisteredError(error.message);
    return {
      ok: false,
      error: existing
        ? "An account with this email already exists. Sign in first, then continue your partner application."
        : "Could not create your account. Please try again.",
      code: "code" in error ? String((error as { code?: string }).code ?? "") : undefined,
      existingAccount: existing,
    };
  }

  if (!data.user?.id) {
    // Supabase may obfuscate existing emails with empty user — treat as existing.
    return {
      ok: false,
      error:
        "An account with this email already exists. Sign in first, then continue your partner application.",
      existingAccount: true,
    };
  }

  // When email already exists, Supabase can return a user with empty identities.
  const identities = data.user.identities ?? [];
  if (identities.length === 0) {
    return {
      ok: false,
      error:
        "An account with this email already exists. Sign in first, then continue your partner application.",
      existingAccount: true,
    };
  }

  return {
    ok: true,
    userId: data.user.id,
    emailConfirmedAt: data.user.email_confirmed_at ?? null,
  };
}

export async function deletePartnerAuthUserIfOrphan(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch (err) {
    console.error("[partners] orphan auth user cleanup failed", {
      message: err instanceof Error ? err.message : "cleanup failed",
    });
  }
}

export function isEmailAlreadyRegisteredError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("user already") ||
    m.includes("email address is already") ||
    m.includes("duplicate")
  );
}

export async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  // Prefer registry/partners/applications first to avoid listing all users.
  const lowered = email.trim().toLowerCase();
  const { data: app } = await admin
    .from("partner_applications")
    .select("auth_user_id")
    .eq("email", lowered)
    .not("auth_user_id", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (app?.auth_user_id) return String(app.auth_user_id);

  const { data: partner } = await admin
    .from("partners")
    .select("auth_user_id")
    .eq("email", lowered)
    .not("auth_user_id", "is", null)
    .maybeSingle();
  if (partner?.auth_user_id) return String(partner.auth_user_id);

  return null;
}
