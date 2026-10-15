/**
 * Meta Pixel tag configuration. Hostname rules live in `analytics-environment.ts` and are shared
 * with GA4.
 */

import {
  ANALYTICS_APPROVED_HOSTNAMES,
  buildHostnameGuardSnippet,
} from "@/lib/analytics-environment";

export const META_PIXEL_ID = "26827091406927437";

const PIXEL_ID_PATTERN = /^\d{10,20}$/;

export function isValidMetaPixelId(id: string | null | undefined): id is string {
  return typeof id === "string" && PIXEL_ID_PATTERN.test(id);
}

/**
 * Meta's standard base code (unchanged: init + the initial PageView) behind the shared hostname
 * guard. On unapproved hosts it returns before `window.fbq` exists or fbevents.js is requested.
 * Null when the configuration is invalid, so the layout renders no pixel instead of a broken one.
 */
export function buildMetaPixelBootstrapScript(
  pixelId: string = META_PIXEL_ID,
  approved: readonly string[] = ANALYTICS_APPROVED_HOSTNAMES
): string | null {
  if (!isValidMetaPixelId(pixelId)) return null;
  const guard = buildHostnameGuardSnippet(approved);
  if (!guard) return null;
  const id = JSON.stringify(pixelId);
  return [
    "(function(){",
    guard,
    "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?",
    "n.callMethod.apply(n,arguments):n.queue.push(arguments)};",
    "if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];",
    "t=b.createElement(e);t.async=!0;t.src=v;",
    "s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)",
    "}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');",
    `window.fbq('init',${id});`,
    "window.fbq('track','PageView');",
    "})();",
  ].join("");
}