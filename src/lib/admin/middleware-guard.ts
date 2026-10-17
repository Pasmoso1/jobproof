import { buildAdminLoginPath } from "@/lib/admin-constants";
import { isAdminPath } from "@/lib/auth/safe-redirect";

/**
 * Edge-level gate for `/admin/**`.
 *
 * This only answers "is there a signed-in session?" and sends anonymous visitors to the
 * login page with the original admin URL preserved. It deliberately does NOT decide who
 * is an administrator: every admin page, server action and route handler still calls
 * `requireAdminUser*` (ADMIN_EMAILS) server-side. Middleware is defence in depth, never
 * the sole authorization check.
 *
 * @returns the login path+query to redirect to, or `null` when the request may continue.
 */
export function resolveAdminMiddlewareRedirect(input: {
  pathname: string;
  search?: string;
  hasSession: boolean;
}): string | null {
  const pathWithQuery = `${input.pathname}${input.search ?? ""}`;
  if (!isAdminPath(input.pathname)) return null;
  if (input.hasSession) return null;
  return buildAdminLoginPath(pathWithQuery);
}

/** Response headers applied to every admin response (never cacheable / indexable). */
export const ADMIN_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
