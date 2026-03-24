/**
 * Public base URL for links in emails (signing, signed copy, etc.).
 */
export function resolvePublicAppOrigin(explicit?: string | null): string {
  const trimmed = explicit?.trim().replace(/\/$/, "");
  if (trimmed) return trimmed;
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
