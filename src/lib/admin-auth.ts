import { redirect } from "next/navigation";
import { createClient as createAuthedClient } from "@/lib/supabase/server";

export function parseAdminEmails(raw = process.env.ADMIN_EMAILS): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const e = email?.trim().toLowerCase();
  if (!e) return false;
  const allowed = parseAdminEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(e);
}

export async function requireAdminUser(): Promise<
  | { ok: true; userEmail: string }
  | { ok: false; reason: "unauthenticated" | "not_authorized"; userEmail: string | null }
> {
  const supabase = await createAuthedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, reason: "unauthenticated", userEmail: null };
  if (!isAdminEmail(user.email)) {
    return { ok: false, reason: "not_authorized", userEmail: user.email ?? null };
  }
  return { ok: true, userEmail: user.email ?? "" };
}

export async function requireAdminUserOrRedirectLogin(): Promise<
  | { ok: true; userEmail: string }
  | { ok: false; reason: "not_authorized"; userEmail: string | null }
> {
  const res = await requireAdminUser();
  if (!res.ok && res.reason === "unauthenticated") {
    redirect("/login?redirect=/admin");
  }
  if (!res.ok) {
    return { ok: false, reason: "not_authorized", userEmail: res.userEmail };
  }
  return res;
}

