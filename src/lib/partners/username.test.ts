import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  looksLikeEmail,
  normalizePartnerUsername,
  validatePartnerPassword,
  validatePartnerUsername,
} from "@/lib/partners/username";

describe("partner username validation", () => {
  it("accepts valid usernames", () => {
    const result = validatePartnerUsername("Jordan.Lee_1");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.username, "Jordan.Lee_1");
    assert.equal(result.normalized, "jordan.lee_1");
  });

  it("rejects too short / reserved / invalid start", () => {
    assert.equal(validatePartnerUsername("ab").ok, false);
    assert.equal(validatePartnerUsername("admin").ok, false);
    assert.equal(validatePartnerUsername("_nope").ok, false);
  });

  it("normalizes case for uniqueness matching", () => {
    assert.equal(normalizePartnerUsername("  AcmePartner "), "acmepartner");
  });

  it("validates password confirmation", () => {
    assert.equal(validatePartnerPassword("secret12", "secret12"), null);
    assert.match(
      validatePartnerPassword("secret12", "other") ?? "",
      /confirmation/i
    );
    assert.match(validatePartnerPassword("short", "short") ?? "", /at least/i);
  });

  it("detects email-shaped identifiers", () => {
    assert.equal(looksLikeEmail("a@b.com"), true);
    assert.equal(looksLikeEmail("jordanlee"), false);
  });
});
