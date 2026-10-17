/**
 * Safe internal redirect helpers for login `next` / auth callback destinations.
 * Rejects open redirects (external hosts, protocol-relative, path traversal).
 */

/** Allow redirects only to same-origin relative paths. */
export function isSafeRelativeRedirect(pathWithQuery: string): boolean {
  const trimmed = String(pathWithQuery ?? "").trim();
  if (!trimmed) return false;
  const path = trimmed.split("?")[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("..")) return false;
  // Reject absolute URLs / schemes that may be encoded oddly.
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("http:") ||
    lower.startsWith("https:") ||
    lower.startsWith("javascript:") ||
    lower.startsWith("data:")
  ) {
    return false;
  }
  return true;
}

/**
 * Partner Program destinations that must not be overridden by contractor
 * onboarding after sign-in.
 */
export function isPartnerProgramDestination(pathWithQuery: string): boolean {
  if (!isSafeRelativeRedirect(pathWithQuery)) return false;
  const path = pathWithQuery.split("?")[0] ?? "";
  return (
    path === "/partner" ||
    path.startsWith("/partner/") ||
    path === "/partners" ||
    path.startsWith("/partners/")
  );
}

/**
 * True for the admin area (`/admin` or `/admin/...`, optionally with a query string).
 * Requires a safe relative path; `/administrator`, `//admin`, `/admin/../x` and
 * absolute URLs are all rejected.
 */
export function isAdminPath(pathWithQuery: string | null | undefined): boolean {
  const value = typeof pathWithQuery === "string" ? pathWithQuery.trim() : "";
  if (!value || !isSafeRelativeRedirect(value)) return false;
  const path = value.split("?")[0] ?? "";
  return path === "/admin" || path.startsWith("/admin/");
}

/** Resolve a login `next` param to a safe internal path, or a fallback. */
export function resolveSafeLoginRedirect(
  next: string | null | undefined,
  fallback = "/dashboard"
): string {
  const value = typeof next === "string" ? next.trim() : "";
  if (value && isSafeRelativeRedirect(value)) return value;
  return fallback;
}

/**
 * When an authenticated user hits /login or /signup, prefer an explicit safe
 * Partner destination over contractor onboarding / dashboard defaults.
 */
export function resolveAuthenticatedAuthPathRedirect(input: {
  next: string | null | undefined;
  contractorFallbackPath: string;
}): string {
  const next = typeof input.next === "string" ? input.next.trim() : "";
  if (next && isPartnerProgramDestination(next)) {
    return next;
  }
  // Admin deep links are safe to honour here: every /admin page and action still
  // enforces ADMIN_EMAILS server-side, so a non-admin simply sees "access required".
  if (next && isAdminPath(next)) {
    return next;
  }
  return input.contractorFallbackPath;
}
