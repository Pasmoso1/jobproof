import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parsePartnerApplicationFormData,
  validatePartnerApplication,
} from "@/lib/partners/submit-application";
import { validateTypeSpecificApplicationFields } from "@/lib/partners/apply-profiles";
import { websiteHref } from "@/lib/partners/admin-application-review";
import {
  normalizeAdditionalProfileLinks,
  normalizeCreatorProfileLink,
  normalizeExternalHttpsUrl,
} from "@/lib/partners/profile-links";

function urlOf(result: { ok: boolean; url?: string }): string {
  assert.equal(result.ok, true);
  return result.url ?? "";
}

function creatorForm(overrides?: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("organization_name", "Site Videos");
  fd.set("contact_name", "Alex Creator");
  fd.set("email", "alex@example.com");
  fd.set("partner_type", "creator");
  fd.set("primary_platform", "instagram");
  fd.set("website", "instagram.com/example");
  fd.set("reason", "Weekly contractor jobsite videos.");
  fd.set("estimated_audience", "8000");
  fd.set("agreement_accepted", "on");
  fd.set("username", "alexcreator");
  fd.set("password", "secret12");
  fd.set("confirm_password", "secret12");
  for (const [k, v] of Object.entries(overrides ?? {})) fd.set(k, v);
  return fd;
}

describe("creator profile link normalization", () => {
  it("accepts Instagram full URL, www, domain-only, @handle, and username", () => {
    assert.equal(
      urlOf(normalizeCreatorProfileLink("instagram", "https://instagram.com/example")),
      "https://instagram.com/example"
    );
    assert.equal(
      urlOf(normalizeCreatorProfileLink("instagram", "www.instagram.com/name")),
      "https://instagram.com/name"
    );
    assert.equal(
      urlOf(normalizeCreatorProfileLink("instagram", "instagram.com/name")),
      "https://instagram.com/name"
    );
    assert.equal(
      urlOf(normalizeCreatorProfileLink("instagram", "@name")),
      "https://instagram.com/name"
    );
    assert.equal(
      urlOf(normalizeCreatorProfileLink("instagram", "name")),
      "https://instagram.com/name"
    );
  });

  it("rejects a Facebook URL when Instagram is selected", () => {
    const result = normalizeCreatorProfileLink(
      "instagram",
      "facebook.com/example"
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Instagram profile/i);
      assert.doesNotMatch(result.error, /URL constructor|Invalid URL/i);
    }
  });

  it("accepts TikTok URLs and handles and canonicalizes with @", () => {
    assert.equal(
      urlOf(normalizeCreatorProfileLink("tiktok", "https://www.tiktok.com/@example")),
      "https://tiktok.com/@example"
    );
    assert.equal(
      urlOf(normalizeCreatorProfileLink("tiktok", "tiktok.com/@example")),
      "https://tiktok.com/@example"
    );
    assert.equal(
      urlOf(normalizeCreatorProfileLink("tiktok", "@example")),
      "https://tiktok.com/@example"
    );
    assert.equal(
      urlOf(normalizeCreatorProfileLink("tiktok", "example")),
      "https://tiktok.com/@example"
    );
  });

  it("accepts YouTube channel URLs without a scheme and @handles", () => {
    assert.equal(
      urlOf(normalizeCreatorProfileLink("youtube", "youtube.com/@contractorjoe")),
      "https://youtube.com/@contractorjoe"
    );
    assert.equal(
      urlOf(normalizeCreatorProfileLink("youtube", "@contractorjoe")),
      "https://youtube.com/@contractorjoe"
    );
  });

  it("does not invent a LinkedIn /in/ path from a bare username", () => {
    const result = normalizeCreatorProfileLink("linkedin", "janedoe");
    assert.equal(result.ok, false);
    assert.equal(
      urlOf(normalizeCreatorProfileLink("linkedin", "linkedin.com/in/janedoe")),
      "https://linkedin.com/in/janedoe"
    );
  });

  it("normalizes generic additional profile links and rejects unsafe schemes", () => {
    const domain = normalizeAdditionalProfileLinks("instagram.com/example");
    assert.equal(domain.ok, true);
    assert.equal(urlOf(domain), "https://instagram.com/example");

    const full = normalizeAdditionalProfileLinks(
      "https://youtube.com/@example, tiktok.com/@other"
    );
    assert.equal(full.ok, true);
    assert.deepEqual(full.urls, [
      "https://youtube.com/@example",
      "https://tiktok.com/@other",
    ]);

    assert.equal(urlOf(normalizeExternalHttpsUrl("https://example.com/x")), "https://example.com/x");
    assert.equal(normalizeExternalHttpsUrl("javascript:alert(1)").ok, false);
    assert.equal(normalizeExternalHttpsUrl("data:text/html,hi").ok, false);
    assert.equal(normalizeExternalHttpsUrl("@barehandle").ok, false);
    assert.equal(normalizeExternalHttpsUrl("http://127.0.0.1/x").ok, false);
  });

  it("persists a normalized Creator website on parse", () => {
    const parsed = parsePartnerApplicationFormData(
      creatorForm({ website: "@abcroofing", primary_platform: "instagram" })
    );
    assert.equal(parsed.website, "https://instagram.com/abcroofing");
    const errors = {
      ...validateTypeSpecificApplicationFields(
        creatorForm({ website: "@abcroofing", primary_platform: "instagram" })
      ),
      ...validatePartnerApplication(parsed, { requirePassword: true }),
    };
    assert.deepEqual(errors, {});
  });

  it("does not change Marketing or Organization type-specific URL rules", () => {
    const marketing = new FormData();
    marketing.set("partner_type", "marketing");
    marketing.set("promotion_method", "paid_media");
    marketing.set("reason", "Paid search.");
    assert.deepEqual(validateTypeSpecificApplicationFields(marketing), {});

    const organization = new FormData();
    organization.set("partner_type", "organization");
    assert.deepEqual(validateTypeSpecificApplicationFields(organization), {});
  });

  it("keeps admin website links clickable for domain-only and canonical https values", () => {
    assert.equal(websiteHref("example.com"), "https://example.com");
    assert.equal(
      websiteHref("https://instagram.com/abcroofing"),
      "https://instagram.com/abcroofing"
    );
    assert.equal(websiteHref("javascript:alert(1)"), null);
  });
});
