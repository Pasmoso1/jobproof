/**
 * GA4 tag configuration. Hostname rules live in `analytics-environment.ts` and are shared with the
 * Meta Pixel.
 */

import {
  ANALYTICS_APPROVED_HOSTNAMES,
  buildHostnameGuardSnippet,
  isAnalyticsAllowedHostname,
  isAnalyticsAllowedInBrowser,
} from "@/lib/analytics-environment";

export { normalizeHostname } from "@/lib/analytics-environment";

export const GA4_MEASUREMENT_ID = "G-74H8WQ0KQ4";

export const GA4_APPROVED_HOSTNAMES: readonly string[] = ANALYTICS_APPROVED_HOSTNAMES;

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;

export const isGa4AllowedHostname = isAnalyticsAllowedHostname;

export const isGa4AllowedInBrowser = isAnalyticsAllowedInBrowser;

export function isValidGa4MeasurementId(id: string | null | undefined): id is string {
  return typeof id === "string" && MEASUREMENT_ID_PATTERN.test(id);
}

/**
 * Inline bootstrap for the root layout: on an approved hostname it installs the standard gtag
 * stub, sends the one automatic page_view via `config`, and only then injects gtag.js. Elsewhere it
 * returns before touching `window.gtag` or the network. Null when the configuration is invalid, so
 * the layout renders no analytics at all instead of a broken tag.
 */
export function buildGa4BootstrapScript(
  measurementId: string = GA4_MEASUREMENT_ID,
  approved: readonly string[] = GA4_APPROVED_HOSTNAMES
): string | null {
  if (!isValidGa4MeasurementId(measurementId)) return null;
  const guard = buildHostnameGuardSnippet(approved);
  if (!guard) return null;
  const id = JSON.stringify(measurementId);
  return [
    "(function(){",
    guard,
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){window.dataLayer.push(arguments);}",
    "window.gtag=gtag;",
    "gtag('js',new Date());",
    `gtag('config',${id});`,
    "var s=document.createElement('script');",
    "s.async=true;",
    `s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(${id});`,
    "document.head.appendChild(s);",
    "})();",
  ].join("");
}
