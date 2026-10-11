import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { Metadata } from "next";
import { buildPublicQuoteUrl } from "@/lib/quote-link-share";
import type { PublicQuoteContractor } from "@/lib/quote-requests/public";

/**
 * Link-preview metadata for a contractor's public quote-request page (`/quote/[slug]`).
 * Only public branding (business name, trade, quote logo) is used — never contact details,
 * addresses, internal IDs or anything a customer submitted.
 */

export const QUOTE_LINK_PREVIEW_DESCRIPTION =
  "Tell us about your project and upload photos to help us prepare your quote.";

export const QUOTE_LINK_PREVIEW_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export const QUOTE_LINK_PREVIEW_IMAGE_SEGMENT = "preview-image";

type PreviewContractor = Pick<
  PublicQuoteContractor,
  "quote_slug" | "business_name" | "quote_logo_url" | "trade_label" | "quote_ready"
>;

export function cleanBusinessName(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

export function buildQuoteLinkPreviewTitle(businessName: string | null | undefined): string {
  const business = cleanBusinessName(businessName);
  return business ? `Request a Quote | ${business}` : "Request a Quote";
}

/**
 * Changes whenever the branding shown in the preview changes, so the image URL changes too and
 * crawler/CDN caches never keep serving an old business name or logo for this page.
 */
export function buildQuoteLinkPreviewVersion(contractor: PreviewContractor): string {
  return createHash("sha256")
    .update(
      [
        contractor.quote_slug.trim().toLowerCase(),
        cleanBusinessName(contractor.business_name),
        contractor.quote_logo_url ?? "",
        contractor.trade_label ?? "",
      ].join("\u0000")
    )
    .digest("hex")
    .slice(0, 12);
}

export function buildQuoteLinkPreviewImageUrl(
  appOrigin: string,
  contractor: PreviewContractor
): string | null {
  const pageUrl = buildPublicQuoteUrl(appOrigin, contractor.quote_slug);
  if (!pageUrl) return null;
  return `${pageUrl}/${QUOTE_LINK_PREVIEW_IMAGE_SEGMENT}?v=${buildQuoteLinkPreviewVersion(contractor)}`;
}

/** Metadata for slugs that don't resolve to a contractor ready to take requests. */
export const UNAVAILABLE_QUOTE_PAGE_METADATA: Metadata = {
  title: "Request a Quote",
  robots: { index: false, follow: false },
};

export function buildQuoteRequestPageMetadata(
  contractor: PreviewContractor | null,
  appOrigin: string
): Metadata {
  if (!contractor || !contractor.quote_ready) return UNAVAILABLE_QUOTE_PAGE_METADATA;
  const pageUrl = buildPublicQuoteUrl(appOrigin, contractor.quote_slug);
  const imageUrl = buildQuoteLinkPreviewImageUrl(appOrigin, contractor);
  if (!pageUrl || !imageUrl) return UNAVAILABLE_QUOTE_PAGE_METADATA;

  const business = cleanBusinessName(contractor.business_name);
  const title = buildQuoteLinkPreviewTitle(business);
  const image = {
    url: imageUrl,
    width: QUOTE_LINK_PREVIEW_IMAGE_SIZE.width,
    height: QUOTE_LINK_PREVIEW_IMAGE_SIZE.height,
    alt: business ? `Request a quote from ${business}` : "Request a quote",
    type: "image/png",
  };

  return {
    title,
    description: QUOTE_LINK_PREVIEW_DESCRIPTION,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      title,
      description: QUOTE_LINK_PREVIEW_DESCRIPTION,
      siteName: business || undefined,
      locale: "en_CA",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: QUOTE_LINK_PREVIEW_DESCRIPTION,
      images: [{ url: imageUrl, alt: image.alt }],
    },
  };
}

// --- Contractor logo for the preview image -------------------------------------------------

const LOGO_FETCH_TIMEOUT_MS = 3000;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MAX_REDIRECTS = 2;

export type PreviewRasterType = "image/png" | "image/jpeg" | "image/gif";

/** Identifies formats the preview renderer can embed, from the file's bytes rather than headers. */
export function detectPreviewRasterType(bytes: Uint8Array): PreviewRasterType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  return null;
}

function isPrivateIpv4(host: string): boolean {
  const [a, b] = host.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/**
 * Contractor logos are URLs the contractor typed in, fetched server-side. Only public HTTPS hosts
 * are allowed so the preview renderer can't be pointed at internal addresses.
 */
export function isFetchableLogoUrl(raw: string | null | undefined): boolean {
  let url: URL;
  try {
    url = new URL(String(raw ?? "").trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost") return false;
  const ipVersion = isIP(host);
  if (ipVersion === 6) return false;
  if (ipVersion === 4) return !isPrivateIpv4(host);
  if (!host.includes(".")) return false;
  return !/\.(localhost|local|internal|home|lan|corp)$/.test(host);
}

/**
 * Downloads the contractor's logo as a data URI the preview renderer can embed, or null when it
 * is missing, unreachable, too large, or in a format the renderer can't draw.
 */
export async function fetchPreviewLogoDataUri(
  logoUrl: string | null | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  let current = String(logoUrl ?? "").trim();
  try {
    for (let hop = 0; hop <= LOGO_MAX_REDIRECTS; hop++) {
      if (!isFetchableLogoUrl(current)) return null;
      const res = await fetchImpl(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(LOGO_FETCH_TIMEOUT_MS),
        headers: { Accept: "image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1" },
        cache: "no-store",
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return null;
        current = new URL(location, current).toString();
        continue;
      }
      if (!res.ok || !res.body) return null;
      const declared = Number(res.headers.get("content-length") ?? "0");
      if (declared > LOGO_MAX_BYTES) return null;

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > LOGO_MAX_BYTES) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const type = detectPreviewRasterType(bytes);
      if (!type) return null;
      return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
    }
    return null;
  } catch {
    return null;
  }
}
