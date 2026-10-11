import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildQuoteLinkIntro,
  buildQuoteLinkMessage,
  buildPublicQuoteUrl,
  buildSmsHref,
} from "@/lib/quote-link-share";
import {
  MAX_QUOTE_REQUEST_PHOTOS,
  MAX_QUOTE_REQUEST_PHOTO_BYTES,
} from "@/lib/quote-requests/constants";
import {
  QUOTE_LINK_PREVIEW_DESCRIPTION,
  QUOTE_LINK_PREVIEW_IMAGE_SIZE,
  UNAVAILABLE_QUOTE_PAGE_METADATA,
  buildQuoteLinkPreviewImageUrl,
  buildQuoteLinkPreviewTitle,
  buildQuoteLinkPreviewVersion,
  buildQuoteRequestPageMetadata,
  detectPreviewRasterType,
  fetchPreviewLogoDataUri,
  isFetchableLogoUrl,
} from "@/lib/quote-requests/link-preview";
import {
  businessInitials,
  renderQuoteLinkPreviewImage,
} from "@/lib/quote-requests/link-preview-image";
import type { PublicQuoteContractor } from "@/lib/quote-requests/public";

function src(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const ORIGIN = "https://www.jobproof.ca";

function contractor(overrides: Partial<PublicQuoteContractor> = {}): PublicQuoteContractor {
  return {
    id: "8d3c6c1e-0000-4000-8000-000000000001",
    quote_slug: "green-construction-2",
    business_name: "Green Construction",
    phone: "416-555-0123",
    quote_logo_url: "https://cdn.example.com/green-logo.png",
    trade_label: "Renovations",
    plan_tier: "professional",
    beta_tester: false,
    beta_plan_tier: null,
    quote_ready: true,
    ...overrides,
  };
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

function imageResponse(bytes: Uint8Array, init: ResponseInit = {}): Response {
  return new Response(new Blob([new Uint8Array(bytes)]), { status: 200, ...init });
}

describe("1–2. Project photos helper text, photos stay optional", () => {
  const form = src("src/app/quote/[slug]/quote-request-form.tsx");

  it("shows the new guidance about wide shots and close-ups", () => {
    const text = form.replace(/\s+/g, " ");
    assert.match(
      text,
      /Please take a few clear photos of the area where the work is needed\. Include a wide shot of the entire area and close-ups of anything that needs repair, replacement or attention\./
    );
    assert.match(
      text,
      /These photos help your contractor understand the job and prepare before contacting you\./
    );
    assert.doesNotMatch(text, /Upload photos or take pictures with your phone camera/);
  });

  it("keeps the camera and upload buttons, limits and optional label", () => {
    assert.match(form, />\s*Add photos or take pictures\s*</);
    assert.match(form, />\s*Take a photo\s*</);
    assert.match(form, /capture="environment"/);
    assert.match(form, /Optional\. Up to \{MAX_QUOTE_REQUEST_PHOTOS\} photos, \{maxPhotoMb\} MB each\./);
    assert.equal(MAX_QUOTE_REQUEST_PHOTOS, 10);
    assert.equal(MAX_QUOTE_REQUEST_PHOTO_BYTES, 10 * 1024 * 1024);
  });

  it("never makes the photo inputs required", () => {
    const fileInputs = form.match(/<input[^>]*type="file"[^>]*\/>/g) ?? [];
    assert.equal(fileInputs.length, 2);
    for (const input of fileInputs) assert.doesNotMatch(input, /\brequired\b/);
  });
});

describe("3–6. SMS message", () => {
  const QUOTE_URL = buildPublicQuoteUrl(ORIGIN, "green-construction-2")!;

  it("uses the contractor's business name and quote URL", () => {
    const message = buildQuoteLinkMessage({ businessName: "Green Construction", quoteUrl: QUOTE_URL });
    assert.equal(
      message,
      [
        "Thanks for contacting Green Construction!",
        "",
        "To help us understand your project and prepare your quote, please tell us what you need and upload a few photos of the work area using the link below.",
        "",
        "https://www.jobproof.ca/quote/green-construction-2",
      ].join("\n")
    );
    const body = decodeURIComponent(buildSmsHref("+14165550123", message).split("?body=")[1]!);
    assert.equal(body, message);
    assert.equal(body.split("\n").at(-1), QUOTE_URL);
  });

  it("uses a different contractor's own name and link", () => {
    const otherUrl = buildPublicQuoteUrl(ORIGIN, "acme-painting")!;
    const message = buildQuoteLinkMessage({ businessName: "Acme Painting", quoteUrl: otherUrl });
    assert.ok(message.startsWith("Thanks for contacting Acme Painting!"));
    assert.ok(message.endsWith(otherUrl));
    assert.doesNotMatch(message, /Green Construction|green-construction/);
  });

  it("falls back safely without a business name", () => {
    for (const missing of [null, undefined, "", "   "]) {
      const message = buildQuoteLinkMessage({ businessName: missing, quoteUrl: QUOTE_URL });
      assert.ok(message.startsWith("Thanks for getting in touch!\n\nTo help us understand your project"));
      assert.doesNotMatch(message, /contacting\s*!/);
    }
  });

  it("does not promote JobProof or add marketing", () => {
    const intro = buildQuoteLinkIntro("Green Construction");
    assert.doesNotMatch(intro, /jobproof|software|sign up|free|trial|download|www\.|https?:/i);
    const message = buildQuoteLinkMessage({ businessName: "Green Construction", quoteUrl: QUOTE_URL });
    assert.equal(message.match(/https?:\/\//g)?.length, 1, "only the quote link");
    assert.ok(message.length <= 260, "stays concise");
  });
});

describe("7–9. contractor-specific link previews", () => {
  it("titles, describes and links the preview to this contractor's page", () => {
    const meta = buildQuoteRequestPageMetadata(contractor(), ORIGIN);
    const pageUrl = "https://www.jobproof.ca/quote/green-construction-2";
    assert.equal(meta.title, "Request a Quote | Green Construction");
    assert.equal(meta.description, QUOTE_LINK_PREVIEW_DESCRIPTION);
    assert.equal(
      QUOTE_LINK_PREVIEW_DESCRIPTION,
      "Tell us about your project and upload photos to help us prepare your quote."
    );
    assert.deepEqual(meta.alternates, { canonical: pageUrl });
    const og = meta.openGraph as Record<string, unknown>;
    assert.equal(og.title, "Request a Quote | Green Construction");
    assert.equal(og.description, QUOTE_LINK_PREVIEW_DESCRIPTION);
    assert.equal(og.url, pageUrl);
    assert.equal(og.siteName, "Green Construction");
    assert.equal(og.type, "website");
    const twitter = meta.twitter as Record<string, unknown>;
    assert.equal(twitter.card, "summary_large_image");
    assert.equal(twitter.title, "Request a Quote | Green Construction");
  });

  it("points the image at this contractor's public, versioned preview", () => {
    const meta = buildQuoteRequestPageMetadata(contractor(), ORIGIN);
    const [image] = (meta.openGraph as { images: Array<Record<string, unknown>> }).images;
    const url = new URL(String(image!.url));
    assert.equal(url.protocol, "https:");
    assert.equal(url.host, "www.jobproof.ca");
    assert.equal(url.pathname, "/quote/green-construction-2/preview-image");
    assert.match(url.searchParams.get("v") ?? "", /^[0-9a-f]{12}$/);
    assert.equal(image!.width, QUOTE_LINK_PREVIEW_IMAGE_SIZE.width);
    assert.equal(image!.height, QUOTE_LINK_PREVIEW_IMAGE_SIZE.height);
    const [twitterImage] = (meta.twitter as { images: Array<{ url: string }> }).images;
    assert.equal(twitterImage!.url, image!.url);
  });

  it("generates independent metadata per contractor", () => {
    const a = buildQuoteRequestPageMetadata(contractor(), ORIGIN);
    const b = buildQuoteRequestPageMetadata(
      contractor({
        quote_slug: "acme-painting",
        business_name: "Acme Painting",
        quote_logo_url: null,
        trade_label: "Painting",
      }),
      ORIGIN
    );
    assert.equal(b.title, "Request a Quote | Acme Painting");
    assert.doesNotMatch(JSON.stringify(b), /Green Construction|green-construction|green-logo/);
    assert.notEqual(
      (a.openGraph as { images: Array<{ url: string }> }).images[0]!.url,
      (b.openGraph as { images: Array<{ url: string }> }).images[0]!.url
    );
  });

  it("changes the image URL whenever the branding changes", () => {
    const base = buildQuoteLinkPreviewVersion(contractor());
    assert.equal(base, buildQuoteLinkPreviewVersion(contractor()));
    assert.notEqual(base, buildQuoteLinkPreviewVersion(contractor({ quote_logo_url: "https://cdn.example.com/new.png" })));
    assert.notEqual(base, buildQuoteLinkPreviewVersion(contractor({ quote_logo_url: null })));
    assert.notEqual(base, buildQuoteLinkPreviewVersion(contractor({ business_name: "Green Construction Ltd." })));
    assert.notEqual(base, buildQuoteLinkPreviewVersion(contractor({ quote_slug: "green-construction-3" })));
    assert.ok(buildQuoteLinkPreviewImageUrl(ORIGIN, contractor())!.endsWith(`?v=${base}`));
  });

  it("never falls back to the JobProof marketing title for a valid contractor", () => {
    const meta = buildQuoteRequestPageMetadata(contractor(), ORIGIN);
    assert.notEqual(meta.title, "JobProof");
    assert.doesNotMatch(String(meta.title), /JobProof/);
    assert.doesNotMatch(String(meta.description), /JobProof|contractors turn customer inquiries/);
  });

  it("builds a plain title when the business name is blank", () => {
    assert.equal(buildQuoteLinkPreviewTitle("  "), "Request a Quote");
    assert.equal(buildQuoteLinkPreviewTitle(" Smith  &  Sons "), "Request a Quote | Smith & Sons");
  });
});

describe("9. preview logo handling", () => {
  it("embeds PNG, JPEG and GIF logos and rejects formats the renderer can't draw", () => {
    assert.equal(detectPreviewRasterType(PNG), "image/png");
    assert.equal(detectPreviewRasterType(JPEG), "image/jpeg");
    assert.equal(detectPreviewRasterType(GIF), "image/gif");
    assert.equal(detectPreviewRasterType(WEBP), null);
    assert.equal(detectPreviewRasterType(SVG), null);
    assert.equal(detectPreviewRasterType(new Uint8Array()), null);
  });

  it("only fetches logos from public HTTPS hosts", () => {
    assert.equal(isFetchableLogoUrl("https://cdn.example.com/logo.png"), true);
    assert.equal(isFetchableLogoUrl("https://8.8.8.8/logo.png"), true);
    for (const blocked of [
      null,
      "",
      "not a url",
      "http://cdn.example.com/logo.png",
      "data:image/png;base64,AAAA",
      "https://localhost/logo.png",
      "https://127.0.0.1/logo.png",
      "https://10.0.0.5/logo.png",
      "https://192.168.1.10/logo.png",
      "https://172.20.0.1/logo.png",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/logo.png",
      "https://intranet/logo.png",
      "https://printer.local/logo.png",
      "https://user:pass@cdn.example.com/logo.png",
      "https://cdn.example.com:8443/logo.png",
    ]) {
      assert.equal(isFetchableLogoUrl(blocked), false, String(blocked));
    }
  });

  it("returns a data URI for a usable logo", async () => {
    const uri = await fetchPreviewLogoDataUri("https://cdn.example.com/logo.png", async () =>
      imageResponse(PNG, { headers: { "content-type": "image/png" } })
    );
    assert.ok(uri?.startsWith("data:image/png;base64,"));
  });

  it("detects the real type even when the server mislabels it", async () => {
    const uri = await fetchPreviewLogoDataUri("https://cdn.example.com/logo", async () =>
      imageResponse(JPEG, { headers: { "content-type": "application/octet-stream" } })
    );
    assert.ok(uri?.startsWith("data:image/jpeg;base64,"));
  });

  it("falls back (null) for missing, unsupported, failing or oversized logos", async () => {
    assert.equal(await fetchPreviewLogoDataUri(null, async () => imageResponse(PNG)), null);
    assert.equal(
      await fetchPreviewLogoDataUri("https://cdn.example.com/logo.webp", async () => imageResponse(WEBP)),
      null
    );
    assert.equal(
      await fetchPreviewLogoDataUri("https://cdn.example.com/logo.svg", async () => imageResponse(SVG)),
      null
    );
    assert.equal(
      await fetchPreviewLogoDataUri("https://cdn.example.com/logo.png", async () => new Response("nope", { status: 404 })),
      null
    );
    assert.equal(
      await fetchPreviewLogoDataUri("https://cdn.example.com/logo.png", async () => {
        throw new Error("network down");
      }),
      null
    );
    assert.equal(
      await fetchPreviewLogoDataUri("https://cdn.example.com/logo.png", async () =>
        imageResponse(PNG, { headers: { "content-length": String(5 * 1024 * 1024) } })
      ),
      null
    );
    const huge = new Uint8Array(3 * 1024 * 1024);
    huge.set(PNG);
    assert.equal(
      await fetchPreviewLogoDataUri("https://cdn.example.com/logo.png", async () => imageResponse(huge)),
      null
    );
  });

  it("renders a 1200×630 PNG with the logo, or the contractor's initials without one", async () => {
    const logo = readFileSync(join(process.cwd(), "public/media-kit/favicons/jobproof-favicon-96.png"));
    for (const logoDataUri of [`data:image/png;base64,${logo.toString("base64")}`, null]) {
      const res = renderQuoteLinkPreviewImage({
        businessName: "Green Construction",
        tradeLabel: "Roofer",
        logoDataUri,
        cacheControl: "public, max-age=86400, s-maxage=86400",
      });
      assert.equal(res.headers.get("content-type"), "image/png");
      assert.equal(res.headers.get("cache-control"), "public, max-age=86400, s-maxage=86400");
      const bytes = new Uint8Array(await res.arrayBuffer());
      assert.equal(detectPreviewRasterType(bytes), "image/png");
      const view = new DataView(bytes.buffer, bytes.byteOffset);
      assert.equal(view.getUint32(16), 1200);
      assert.equal(view.getUint32(20), 630);
    }
    assert.equal(businessInitials("Green Construction"), "GC");
    assert.equal(businessInitials("Rénovations Côté & Fils"), "RC");
    assert.equal(businessInitials(""), "");
  });

  it("follows safe redirects but refuses redirects to internal or non-HTTPS addresses", async () => {
    const calls: string[] = [];
    const safe = await fetchPreviewLogoDataUri("https://example.com/logo", async (input) => {
      calls.push(String(input));
      return calls.length === 1
        ? new Response(null, { status: 302, headers: { location: "https://cdn.example.com/logo.png" } })
        : imageResponse(PNG);
    });
    assert.ok(safe?.startsWith("data:image/png;base64,"));
    assert.deepEqual(calls, ["https://example.com/logo", "https://cdn.example.com/logo.png"]);

    for (const location of ["http://cdn.example.com/logo.png", "https://169.254.169.254/latest", "https://127.0.0.1/x"]) {
      let fetched = 0;
      const result = await fetchPreviewLogoDataUri("https://example.com/logo", async () => {
        fetched++;
        return new Response(null, { status: 301, headers: { location } });
      });
      assert.equal(result, null, location);
      assert.equal(fetched, 1, "the unsafe redirect target is never requested");
    }
  });
});

describe("10–11. invalid or unfinished pages expose nothing private", () => {
  it("unknown slugs and unfinished contractors get generic, unindexed metadata", () => {
    assert.deepEqual(buildQuoteRequestPageMetadata(null, ORIGIN), UNAVAILABLE_QUOTE_PAGE_METADATA);
    const unfinished = buildQuoteRequestPageMetadata(contractor({ quote_ready: false }), ORIGIN);
    assert.deepEqual(unfinished, UNAVAILABLE_QUOTE_PAGE_METADATA);
    assert.equal(unfinished.openGraph, undefined);
    assert.doesNotMatch(JSON.stringify(unfinished), /Green Construction/);
  });

  it("metadata never contains contact details, internal IDs or customer data", () => {
    const serialized = JSON.stringify(buildQuoteRequestPageMetadata(contractor(), ORIGIN));
    assert.doesNotMatch(serialized, /416-555-0123|4165550123/);
    assert.doesNotMatch(serialized, /8d3c6c1e-0000-4000-8000-000000000001/);
    assert.doesNotMatch(serialized, /professional|plan_tier|beta/);
    assert.doesNotMatch(serialized, /cdn\.example\.com/, "the logo is rendered into our image, not linked");
  });

  it("the preview image route 404s for unknown or unfinished pages and renders only public branding", () => {
    const route = src("src/app/quote/[slug]/preview-image/route.tsx");
    assert.match(route, /if \(!contractor \|\| !contractor\.quote_ready\) \{[\s\S]*?status: 404/);
    assert.match(route, /getContractorByQuoteSlug\(slug\)/);
    assert.match(route, /renderQuoteLinkPreviewImage\(\{/);
    assert.match(route, /!isCurrentVersion\s*\?\s*"no-store"/);
    assert.doesNotMatch(route, /contractor\.(phone|id|plan_tier|beta_tester)/);
  });
});

describe("12. quote page wiring and branding", () => {
  const page = src("src/app/quote/[slug]/page.tsx");

  it("generates metadata from the same cached contractor lookup as the page", () => {
    assert.match(page, /export async function generateMetadata/);
    assert.match(page, /buildQuoteRequestPageMetadata\(await loadContractor\(slug\), resolveAppUrl\(\)\)/);
    assert.match(page, /const loadContractor = cache\(getContractorByQuoteSlug\);/);
  });

  it("leads with the contractor's name and logo, with a subtle Powered by JobProof", () => {
    assert.match(page, /contractor\.quote_logo_url \?/);
    assert.match(page, /text-lg font-semibold text-zinc-900[^"]*">\s*\{contractor\.business_name\}/);
    assert.match(page, /Powered by\{" "\}[\s\S]*?JobProof/);
    assert.match(page, /<h1[^>]*>Request a Quote<\/h1>/);
  });

  it("still renders the existing form with the slug and contractor phone", () => {
    assert.match(page, /<QuoteRequestForm slug=\{contractor\.quote_slug\} contractorPhone=\{contractor\.phone\} \/>/);
    assert.match(page, /if \(!contractor\) notFound\(\);/);
  });
});
