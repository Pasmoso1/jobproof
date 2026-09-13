import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PARTNER_REFERRAL_COOKIE_DAYS,
  PARTNER_REFERRAL_COOKIE_MAX_AGE_SEC,
  PARTNER_REF_COOKIE_NAME,
  buildPartnerRefSetCookieHeader,
  decidePartnerRefCapture,
  decodePartnerRefCookie,
  isAuthUserEligibleForCookiePartnerAttribution,
  normalizeStoredPartnerRef,
} from "@/lib/partners/partner-ref-cookie";
import { PARTNER_QUALIFICATION_DAYS } from "@/lib/partners/constants";

describe("partner referral cookie — 30-day first-touch", () => {
  it("defines a central 30-day cookie lifetime (not duplicated magic numbers)", () => {
    assert.equal(PARTNER_REFERRAL_COOKIE_DAYS, 30);
    assert.equal(PARTNER_REFERRAL_COOKIE_MAX_AGE_SEC, 30 * 24 * 60 * 60);
    assert.equal(PARTNER_REF_COOKIE_NAME, "jp_partner_ref_v1");

    const source = readFileSync(
      join(process.cwd(), "src/lib/partners/partner-ref-cookie.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /60 \* 60 \* 24 \* 120/);
    assert.match(source, /PARTNER_REFERRAL_COOKIE_DAYS/);
    assert.match(source, /PARTNER_REFERRAL_COOKIE_MAX_AGE_SEC/);
  });

  it("A: stores Partner A from a valid incoming referral code", () => {
    const decision = decidePartnerRefCapture({
      existingCode: null,
      incomingRaw: "jp-aaaa11",
    });
    assert.equal(decision.action, "set");
    assert.equal(decision.code, "JP-AAAA11");
  });

  it("B: keeps Partner A when Partner B is clicked within the window", () => {
    const decision = decidePartnerRefCapture({
      existingCode: "JP-AAAA11",
      incomingRaw: "JP-BBBB22",
    });
    assert.equal(decision.action, "keep");
    assert.equal(decision.code, "JP-AAAA11");
  });

  it("C: invalid Partner B does not destroy Partner A", () => {
    const decision = decidePartnerRefCapture({
      existingCode: "JP-AAAA11",
      incomingRaw: "!!",
    });
    assert.equal(decision.action, "keep");
    assert.equal(decision.code, "JP-AAAA11");
    assert.equal(normalizeStoredPartnerRef("!!"), null);
  });

  it("D: after anonymous attribution expires, Partner B can become first touch", () => {
    // Expired cookie ⇒ read returns null ⇒ decide sees no existing code.
    const decision = decidePartnerRefCapture({
      existingCode: null,
      incomingRaw: "JP-BBBB22",
    });
    assert.equal(decision.action, "set");
    assert.equal(decision.code, "JP-BBBB22");
  });

  it("L: cookie value contains only the referral code (no PII)", () => {
    const header = buildPartnerRefSetCookieHeader("JP-AAAA11", { secure: true });
    assert.ok(header);
    assert.match(header!, /^jp_partner_ref_v1=JP-AAAA11;/);
    assert.doesNotMatch(header!, /email|@|phone|user_id|name=/i);
    assert.equal(decodePartnerRefCookie("JP-AAAA11"), "JP-AAAA11");
  });

  it("M: production cookie settings are path=/, SameSite=Lax, Secure on HTTPS, 30-day max-age", () => {
    const header = buildPartnerRefSetCookieHeader("JP-AAAA11", { secure: true });
    assert.ok(header);
    assert.match(header!, /path=\//);
    assert.match(header!, /samesite=lax/i);
    assert.match(header!, /secure/i);
    assert.match(
      header!,
      new RegExp(`max-age=${PARTNER_REFERRAL_COOKIE_MAX_AGE_SEC}`)
    );
    // Not HttpOnly — client capture + signup banner require readable cookie.
    assert.doesNotMatch(header!, /httponly/i);
  });

  it("I/J: existing Auth users outside the window are not cookie-eligible", () => {
    const now = Date.parse("2026-09-13T12:00:00.000Z");
    assert.equal(
      isAuthUserEligibleForCookiePartnerAttribution(
        "2026-09-01T12:00:00.000Z",
        now
      ),
      true
    );
    assert.equal(
      isAuthUserEligibleForCookiePartnerAttribution(
        "2026-08-01T12:00:00.000Z",
        now
      ),
      false
    );
    assert.equal(
      isAuthUserEligibleForCookiePartnerAttribution(null, now),
      false
    );
  });

  it("K: 90-day paid qualification remains independent of cookie duration", () => {
    assert.equal(PARTNER_QUALIFICATION_DAYS, 90);
    assert.notEqual(PARTNER_QUALIFICATION_DAYS, PARTNER_REFERRAL_COOKIE_DAYS);
  });

  it("wires capture + auth/signup attribution paths for first-touch permanence", () => {
    const capture = readFileSync(
      join(process.cwd(), "src/components/partner-ref-capture.tsx"),
      "utf8"
    );
    assert.match(capture, /useSearchParams/);
    assert.match(capture, /capturePartnerRefFromSearchParamsClient/);

    const cookie = readFileSync(
      join(process.cwd(), "src/lib/partners/partner-ref-cookie.ts"),
      "utf8"
    );
    assert.match(cookie, /decidePartnerRefCapture/);
    assert.match(cookie, /first-touch/i);
    assert.match(cookie, /removeItem\(PARTNER_REF_LOCALSTORAGE_KEY\)/);

    const apply = readFileSync(
      join(process.cwd(), "src/lib/partners/apply-attribution.ts"),
      "utf8"
    );
    assert.match(apply, /isAuthUserEligibleForCookiePartnerAttribution/);
    assert.match(apply, /signup_partner_referral_code/);

    const attribution = readFileSync(
      join(process.cwd(), "src/lib/partners/attribution.ts"),
      "utf8"
    );
    assert.match(attribution, /first referral wins/i);
    assert.match(attribution, /\.is\("signup_partner_referral_code", null\)/);
    assert.match(attribution, /status", "active"/);

    const callback = readFileSync(
      join(process.cwd(), "src/app/auth/callback/route.ts"),
      "utf8"
    );
    assert.match(callback, /independent of UTM first-touch/);
    assert.match(callback, /userCreatedAt/);

    const signup = readFileSync(
      join(process.cwd(), "src/app/(auth)/signup/page.tsx"),
      "utf8"
    );
    assert.match(signup, /applyPartnerReferralAttributionFromSession/);
    assert.match(signup, /do not apply Partner cookie attribution/i);
  });
});
