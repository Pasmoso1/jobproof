/**
 * Single source of truth for where third-party analytics (GA4, Meta Pixel) may run. Decided by the
 * page's hostname in the browser — not NODE_ENV, because `next start` on localhost is also a
 * production build. Anything not listed (localhost, 127.0.0.1, LAN IPs, *.vercel.app previews,
 * other subdomains, look-alike domains) never loads a tracking script and never sends events.
 */

export const ANALYTICS_APPROVED_HOSTNAMES: readonly string[] = ["www.jobproof.ca", "jobproof.ca"];

export function normalizeHostname(hostname: string | null | undefined): string {
  return String(hostname ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

/** Exact match only: subdomains and look-alikes (e.g. jobproof.ca.example.com) are rejected. */
export function isAnalyticsAllowedHostname(
  hostname: string | null | undefined,
  approved: readonly string[] = ANALYTICS_APPROVED_HOSTNAMES
): boolean {
  const host = normalizeHostname(hostname);
  return host !== "" && approved.includes(host);
}

/** Browser-side check shared by every tag bootstrap and event helper. */
export function isAnalyticsAllowedInBrowser(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return isAnalyticsAllowedHostname(window.location?.hostname);
  } catch {
    return false;
  }
}

/**
 * Inline-script prologue applying the same rule before any tag code runs. Must be placed at the
 * top of a function body (it `return`s on unapproved hosts). Null when no hosts are approved.
 */
export function buildHostnameGuardSnippet(
  approved: readonly string[] = ANALYTICS_APPROVED_HOSTNAMES
): string | null {
  const hosts = approved.map(normalizeHostname).filter(Boolean);
  if (hosts.length === 0) return null;
  return [
    `var hosts=${JSON.stringify(hosts)};`,
    'var host=String((window.location&&window.location.hostname)||"").trim().toLowerCase().replace(/\\.$/,"");',
    "if(hosts.indexOf(host)===-1)return;",
  ].join("");
}