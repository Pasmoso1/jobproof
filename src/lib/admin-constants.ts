import { isAdminPath } from "@/lib/auth/safe-redirect";

/** Post-logout / unauthenticated redirect target for the admin home. */
export const ADMIN_LOGIN_PATH = "/login?next=/admin";

/**
 * Login URL that returns the user to a specific admin page after sign-in.
 * Falls back to {@link ADMIN_LOGIN_PATH} unless `nextPath` is a safe `/admin` path,
 * so this can never be turned into an open redirect.
 */
export function buildAdminLoginPath(nextPath?: string | null): string {
  const value = typeof nextPath === "string" ? nextPath.trim() : "";
  if (!value || value === "/admin" || !isAdminPath(value)) return ADMIN_LOGIN_PATH;
  return `/login?next=${encodeURIComponent(value)}`;
}
