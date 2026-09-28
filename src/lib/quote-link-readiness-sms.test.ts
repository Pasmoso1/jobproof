import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GetMoreWorkCard } from "@/components/dashboard/get-more-work-card";
import {
  COMPLETE_BUSINESS_PROFILE_PATH,
  buildPublicQuoteUrl,
  buildQuoteLinkIntro,
  buildQuoteLinkMessage,
  buildSmsHref,
  normalizeCustomerMobileNumber,
} from "@/lib/quote-link-share";
import {
  isPublicQuotePageReady,
  isQuoteSharingReady,
  type QuoteReadinessProfile,
} from "@/lib/quote-requests/readiness";
import { isOnboardingCompleteForTrial } from "@/lib/trial-lifecycle";

function src(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const ORIGIN = "https://www.jobproof.ca";
const QUOTE_URL = `${ORIGIN}/quote/green-construction-2`;
const EMAIL = "owner@example.com";

const COMPLETE_PROFILE: QuoteReadinessProfile = {
  business_name: "Green Construction",
  phone: "416-555-0123",
  address_line_1: "1 Main St",
  city: "Toronto",
  province: "ON",
  postal_code: "M5V 2T6",
  quote_primary_trade: "Renovator",
};

/** Mirrors how Android/iOS SMS handlers read the RFC 5724 body parameter. */
function parseSmsHref(href: string): { recipient: string; body: string } {
  assert.ok(href.startsWith("sms:"), href);
  const rest = href.slice("sms:".length);
  const q = rest.indexOf("?");
  const recipient = rest.slice(0, q);
  const params = new URLSearchParams(rest.slice(q + 1));
  return { recipient, body: params.get("body") ?? "" };
}

function renderCard(props: {
  quoteUrl: string | null;
  profileReady: boolean;
  businessName?: string | null;
}): string {
  return renderToStaticMarkup(
    createElement(GetMoreWorkCard, {
      quoteUrl: props.quoteUrl,
      businessName: props.businessName ?? "Green Construction",
      variant: "prominent",
      profileReady: props.profileReady,
    })
  );
}

describe("1. Android-compatible SMS URI and body", () => {
  it("uses the RFC 5724 sms:<number>?body=<percent-encoded> form", () => {
    const message = buildQuoteLinkMessage({ businessName: "Green Construction", quoteUrl: QUOTE_URL });
    const href = buildSmsHref("+14165550123", message);
    assert.equal(
      href,
      "sms:+14165550123?body=Hi%2C%20it's%20Green%20Construction.%20Need%20a%20quote%3F%20Tell%20us%20about%20the%20work%20you%20need%20here%3A%0A%0Ahttps%3A%2F%2Fwww.jobproof.ca%2Fquote%2Fgreen-construction-2"
    );
    assert.doesNotMatch(href, /\?&body=/);
    assert.doesNotMatch(href, /\+(?!1416)/, "spaces must be %20, never +");
    assert.equal(href.split("?").length, 2, "only one query separator");
  });

  it("decodes to exactly the message with the approved copy", () => {
    const message = buildQuoteLinkMessage({ businessName: "Green Construction", quoteUrl: QUOTE_URL });
    assert.equal(
      message,
      "Hi, it's Green Construction. Need a quote? Tell us about the work you need here:\n\nhttps://www.jobproof.ca/quote/green-construction-2"
    );
    assert.equal(parseSmsHref(buildSmsHref("+14165550123", message)).body, message);
  });
});

describe("2. absolute HTTPS quote URL", () => {
  it("builds an absolute https URL from the production origin", () => {
    const url = new URL(buildPublicQuoteUrl(ORIGIN, "green-construction-2")!);
    assert.equal(url.protocol, "https:");
    assert.equal(url.host, "www.jobproof.ca");
    assert.equal(url.pathname, "/quote/green-construction-2");
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
  });

  it("does not double slashes when the origin has a trailing slash", () => {
    assert.equal(buildPublicQuoteUrl(`${ORIGIN}/`, "green-construction-2"), QUOTE_URL);
  });
});

describe("3. URL is unmodified in the decoded body", () => {
  it("round-trips the URL byte-for-byte with nothing appended", () => {
    const { body } = parseSmsHref(
      buildSmsHref("+14165550123", buildQuoteLinkMessage({ businessName: "Green Construction", quoteUrl: QUOTE_URL }))
    );
    assert.ok(body.endsWith(QUOTE_URL));
    const lastLine = body.split("\n").at(-1)!;
    assert.equal(lastLine, QUOTE_URL);
    assert.doesNotMatch(body, /[<>[\]()]|href=|\]\(/, "no HTML, Markdown or brackets");
    assert.doesNotMatch(lastLine, /[.,;:!?)]$/, "no trailing punctuation");
  });
});

describe("4. URL on its own line", () => {
  it("separates the URL from the intro with a blank line", () => {
    const message = buildQuoteLinkMessage({ businessName: "Green Construction", quoteUrl: QUOTE_URL });
    const lines = message.split("\n");
    assert.deepEqual(lines, [
      "Hi, it's Green Construction. Need a quote? Tell us about the work you need here:",
      "",
      QUOTE_URL,
    ]);
    assert.match(buildSmsHref("+14165550123", message), /%0A%0Ahttps%3A%2F%2F/);
  });
});

describe("5. business names with special characters", () => {
  for (const name of [
    "Smith & Sons",
    "Joe's Painting",
    "Rénovations Côté & Fils",
    "A+B Reno #1 (Toronto)",
    "50% Off Decks?",
    "  Green\nConstruction  ",
  ]) {
    it(`encodes "${name.replace(/\n/g, "\\n")}" without corrupting the URL`, () => {
      const message = buildQuoteLinkMessage({ businessName: name, quoteUrl: QUOTE_URL });
      const href = buildSmsHref("+14165550123", message);
      const { body } = parseSmsHref(href);
      assert.equal(body, message);
      assert.equal(body.split("\n").at(-1), QUOTE_URL);
      assert.equal(body.split("\n").length, 3, "business name cannot inject extra lines");
      assert.doesNotMatch(href.slice(href.indexOf("?") + 1), /&(?!$)/, "raw & would split the body");
    });
  }

  it("falls back to a neutral greeting without a business name", () => {
    assert.equal(
      buildQuoteLinkIntro(null),
      "Hi! Need a quote? Tell us about the work you need here:"
    );
  });
});

describe("6. Canadian/US phone formats", () => {
  for (const [input, expected] of [
    ["416-555-0123", "+14165550123"],
    ["(416) 555-0123", "+14165550123"],
    ["416.555.0123", "+14165550123"],
    ["4165550123", "+14165550123"],
    ["1-416-555-0123", "+14165550123"],
    ["+1 416 555 0123", "+14165550123"],
    ["+1 (212) 555-0199", "+12125550199"],
    ["+44 20 7946 0958", "+442079460958"],
  ] as const) {
    it(`normalizes ${input}`, () => {
      assert.equal(normalizeCustomerMobileNumber(input), expected);
      assert.ok(buildSmsHref(expected, "x").startsWith(`sms:${expected}?body=`));
    });
  }

  for (const bad of ["555-0123", "call me", "", "416-555-012a", "12345678901234567"]) {
    it(`rejects ${JSON.stringify(bad)}`, () => {
      assert.equal(normalizeCustomerMobileNumber(bad), null);
    });
  }
});

describe("7. no customer PII sent to JobProof", () => {
  const card = src("src/components/dashboard/get-more-work-card.tsx");

  it("the phone number only ever goes into the on-device sms: link", () => {
    assert.match(card, /window\.location\.href = buildSmsHref\(normalized, message\)/);
    assert.doesNotMatch(card, /fetch\(|axios|sendBeacon|XMLHttpRequest/);
    assert.doesNotMatch(card, /from "@\/app\/|Action\(|"use server"/);
    assert.doesNotMatch(card, /twilio|sendTwilioSms/i);
    assert.doesNotMatch(card, /gtag|trackGa4|track[A-Z]\w*\(/);
  });

  it("the message and URL contain no phone number or internal IDs", () => {
    const message = buildQuoteLinkMessage({ businessName: "Green Construction", quoteUrl: QUOTE_URL });
    assert.doesNotMatch(message, /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/);
    assert.doesNotMatch(message, /[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});

describe("8. missing or incomplete business profile", () => {
  it("is not ready without a business name or primary trade", () => {
    assert.equal(isQuoteSharingReady({ ...COMPLETE_PROFILE, business_name: "" }, EMAIL), false);
    assert.equal(isQuoteSharingReady({ ...COMPLETE_PROFILE, quote_primary_trade: null }, EMAIL), false);
    assert.equal(isQuoteSharingReady({ ...COMPLETE_PROFILE, phone: null }, EMAIL), false);
    assert.equal(isQuoteSharingReady({ ...COMPLETE_PROFILE, postal_code: "" }, EMAIL), false);
    assert.equal(isQuoteSharingReady(null, EMAIL), false);
  });

  it("public quote page is not ready for incomplete profiles", () => {
    assert.equal(isPublicQuotePageReady({ ...COMPLETE_PROFILE, quote_primary_trade: " " }), false);
    assert.equal(isPublicQuotePageReady({ ...COMPLETE_PROFILE, business_name: null }), false);
    assert.equal(isPublicQuotePageReady(null), false);
  });
});

describe("9. completed business profile", () => {
  it("is ready once the onboarding rule is satisfied", () => {
    assert.equal(isQuoteSharingReady(COMPLETE_PROFILE, EMAIL), true);
    assert.equal(isPublicQuotePageReady(COMPLETE_PROFILE), true);
  });

  it("uses the same rule as onboarding completion (no competing definition)", () => {
    const variants: QuoteReadinessProfile[] = [
      COMPLETE_PROFILE,
      { ...COMPLETE_PROFILE, business_name: "" },
      { ...COMPLETE_PROFILE, quote_primary_trade: "" },
      { ...COMPLETE_PROFILE, phone: "123" },
      { ...COMPLETE_PROFILE, province: "XX" },
      { ...COMPLETE_PROFILE, postal_code: "12345" },
      { ...COMPLETE_PROFILE, city: "" },
      { ...COMPLETE_PROFILE, address_line_1: "" },
    ];
    for (const p of variants) {
      const onboarding = isOnboardingCompleteForTrial(p, EMAIL);
      assert.equal(isQuoteSharingReady(p, EMAIL), onboarding);
      assert.equal(isPublicQuotePageReady(p), onboarding);
    }
  });
});

describe("10. sharing controls hidden before required setup", () => {
  it("shows Complete your profile and none of the sharing tools", () => {
    const html = renderCard({ quoteUrl: QUOTE_URL, profileReady: false });
    assert.match(html, /Get more work/);
    assert.match(html, /Get your next job/);
    assert.match(
      html,
      /Complete your business profile so customers can tell you what they need and request a quote\./
    );
    assert.match(html, new RegExp(`href="${COMPLETE_BUSINESS_PROFILE_PATH}"[^>]*>Complete your profile<`));
    for (const hidden of [
      "Customer&#x27;s mobile number",
      "Send quote link",
      "Copy link",
      "Show QR code",
      ">Share<",
      'type="tel"',
      QUOTE_URL,
    ]) {
      assert.ok(!html.includes(hidden), `should not render ${hidden}`);
    }
  });

  it("dashboard derives readiness from the onboarding rule and passes it to the card", () => {
    const dashboard = src("src/app/(app)/dashboard/page.tsx");
    assert.match(dashboard, /const quoteSharingReady = isQuoteSharingReady\(profile, user\?\.email \?\? ""\)/);
    assert.match(dashboard, /profileReady=\{quoteSharingReady\}/);
    assert.match(dashboard, /ensureQuoteSlugForProfile\(supabase,/, "automatic link creation is kept");
  });

  it("public page blocks new requests for incomplete accounts but keeps existing flows", () => {
    const page = src("src/app/quote/[slug]/page.tsx");
    assert.match(page, /if \(!contractor\.quote_ready\) \{/);
    assert.match(page, /Online quote requests aren&apos;t available yet/);
    const actions = src("src/app/quote/[slug]/actions.ts");
    assert.equal((actions.match(/!contractor \|\| !contractor\.quote_ready/g) ?? []).length, 2);
    const publicLib = src("src/lib/quote-requests/public.ts");
    assert.match(publicLib, /quote_ready: isPublicQuotePageReady\(data\)/);
    assert.match(publicLib, /\.ilike\("quote_slug", normalized\)/);
    const success = src("src/app/quote/[slug]/success/page.tsx");
    assert.doesNotMatch(success, /quote_ready/);
  });
});

describe("11. sharing controls available after required setup", () => {
  it("renders the send form, copy, QR and share", () => {
    const html = renderCard({ quoteUrl: QUOTE_URL, profileReady: true });
    for (const shown of [
      "Customer&#x27;s mobile number",
      "Send quote link",
      "Copy link",
      "Show QR code",
      ">Share<",
      'type="tel"',
    ]) {
      assert.ok(html.includes(shown), `should render ${shown}`);
    }
    assert.ok(!html.includes("Complete your profile"));
    assert.ok(!html.includes("Set up your quote link"));
  });

  it("keeps the manual setup fallback when a ready profile has no link", () => {
    const html = renderCard({ quoteUrl: null, profileReady: true });
    assert.match(html, /Set up your quote link/);
    assert.ok(!html.includes("Send quote link"));
  });
});

describe("copy, share and QR use the same canonical URL", () => {
  const card = src("src/components/dashboard/get-more-work-card.tsx");

  it("every action reads the single quoteUrl prop", () => {
    assert.match(card, /const ok = await copyText\(quoteUrl\);/);
    assert.match(card, /url: quoteUrl,/);
    assert.match(card, /toDataURL\(quoteUrl,/);
    assert.match(card, /buildQuoteLinkMessage\(\{ businessName, quoteUrl \}\)/);
    const html = renderCard({ quoteUrl: QUOTE_URL, profileReady: true });
    assert.ok(html.includes(QUOTE_URL), "QR dialog shows the same URL");
  });

  it("share sends the intro and URL separately so the link is not duplicated", () => {
    assert.match(card, /text: buildQuoteLinkIntro\(businessName\),/);
    assert.doesNotMatch(buildQuoteLinkIntro("Green Construction"), /https?:\/\//);
  });
});
