import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAppNavLinks, isAppNavLinkActive } from "@/lib/app-nav";
import {
  QUOTE_REQUEST_SETTINGS_PATH,
  buildPublicQuoteUrl,
  buildQuoteLinkMessage,
  buildSmsHref,
  normalizeCustomerMobileNumber,
} from "@/lib/quote-link-share";

function src(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const layoutSource = src("src/app/(app)/layout.tsx");
const mobileNavSource = src("src/components/app-mobile-nav.tsx");
const cardSource = src("src/components/dashboard/get-more-work-card.tsx");
const dashboardSource = src("src/app/(app)/dashboard/page.tsx");
const emptyOnboardingSource = src("src/components/onboarding/dashboard-empty-onboarding.tsx");
const settingsFormSource = src(
  "src/app/(app)/settings/quote-requests/quote-request-settings-form.tsx"
);

const ORIGIN = "https://app.jobproof.example";
const QUOTE_URL = `${ORIGIN}/quote/acme-painting`;

const ALL_DESTINATIONS = [
  ["Dashboard", "/dashboard"],
  ["Collections", "/collections"],
  ["Estimates", "/estimates"],
  ["Quote Requests", "/quote-requests"],
  ["Create Job", "/jobs/create"],
  ["Settings", "/settings/business"],
  ["Billing", "/settings/billing"],
  ["Support", "/support"],
] as const;

describe("A. desktop navigation", () => {
  it("renders every destination from the shared nav list at lg and up", () => {
    assert.match(layoutSource, /getAppNavLinks\(\{ showPartnerPortal \}\)/);
    assert.match(layoutSource, /navLinks\.map\(/);
    assert.match(layoutSource, /className="hidden flex-wrap items-center justify-end gap-x-4 gap-y-2 lg:flex"/);
    assert.match(layoutSource, /<QuoteRequestsNavLink key=\{link\.key\} newCount=\{newQuoteRequestCount\} \/>/);
    assert.match(layoutSource, /Send feedback/);
    assert.match(layoutSource, /<LogoutButton \/>/);
  });

  it("keeps the original link order and hrefs", () => {
    const links = getAppNavLinks({ showPartnerPortal: false });
    assert.deepEqual(
      links.map((l) => [l.label, l.href]),
      ALL_DESTINATIONS.map(([label, href]) => [label, href])
    );
  });

  it("header grows instead of clipping when links wrap", () => {
    assert.doesNotMatch(layoutSource, /flex h-14 /);
    assert.match(layoutSource, /min-h-14/);
    assert.match(layoutSource, /pt-\[env\(safe-area-inset-top\)\]/);
  });
});

describe("B. mobile does not render the desktop link row", () => {
  it("hides the desktop nav below lg and shows the menu only below lg", () => {
    assert.match(layoutSource, /className="hidden flex-wrap[^"]*lg:flex"/);
    assert.match(layoutSource, /<div className="lg:hidden">\s*<AppMobileNav/);
  });

  it("only one component owns mobile navigation", () => {
    const mobileMenus = layoutSource.match(/<AppMobileNav/g) ?? [];
    assert.equal(mobileMenus.length, 1);
    assert.match(mobileNavSource, /getAppNavLinks\(\{ showPartnerPortal \}\)/);
  });
});

describe("C. mobile menu contains every destination", () => {
  it("includes all core destinations plus Partner Portal when applicable", () => {
    const withPartner = getAppNavLinks({ showPartnerPortal: true });
    assert.deepEqual(
      withPartner.map((l) => l.label),
      [...ALL_DESTINATIONS.map(([label]) => label), "Partner Portal"]
    );
    assert.equal(withPartner.at(-1)?.href, "/partner");
    assert.equal(
      getAppNavLinks({ showPartnerPortal: false }).some((l) => l.key === "partner-portal"),
      false
    );
  });

  it("renders Send feedback, Log out and the quote-request badge", () => {
    assert.match(mobileNavSource, /links\.map\(/);
    assert.match(mobileNavSource, /href=\{feedbackHref\}/);
    assert.match(mobileNavSource, /Send feedback/);
    assert.match(mobileNavSource, /<LogoutButton className=\{menuItemClassName\} \/>/);
    assert.match(mobileNavSource, /link\.key === "quote-requests" && newQuoteRequestCount > 0/);
  });

  it("closes after navigation and on route change", () => {
    assert.match(mobileNavSource, /href=\{link\.href\}\s*onClick=\{closeMenu\}/);
    assert.match(mobileNavSource, /pathname !== lastPathname/);
  });

  it("uses large touch targets without shrinking text", () => {
    assert.match(mobileNavSource, /min-h-12/);
    assert.match(mobileNavSource, /text-base font-medium/);
    assert.doesNotMatch(mobileNavSource, /text-\[(?:[0-9]|1[01])px\]/);
  });
});

describe("D. accessibility state", () => {
  it("menu button exposes expanded state and controls the dialog", () => {
    assert.match(mobileNavSource, /aria-expanded=\{open\}/);
    assert.match(mobileNavSource, /aria-controls=\{menuId\}/);
    assert.match(mobileNavSource, /aria-haspopup="dialog"/);
    assert.match(mobileNavSource, /id=\{menuId\}/);
  });

  it("menu is a modal dialog with a labelled close control and focus return", () => {
    assert.match(mobileNavSource, /<dialog/);
    assert.match(mobileNavSource, /dialog\.showModal\(\)/);
    assert.match(mobileNavSource, /aria-label="Close menu"/);
    assert.match(mobileNavSource, /onClose=\{handleDialogClose\}/);
    assert.match(mobileNavSource, /menuButtonRef\.current\?\.focus\(\)/);
    assert.match(mobileNavSource, /closeButtonRef\.current\?\.focus\(\)/);
    assert.match(mobileNavSource, /e\.key === "Escape"/);
    assert.match(mobileNavSource, /aria-current=\{active \? "page" : undefined\}/);
  });

  it("marks only the current page active", () => {
    assert.equal(isAppNavLinkActive("/dashboard", "/dashboard"), true);
    assert.equal(isAppNavLinkActive("/dashboard/x", "/dashboard"), false);
    assert.equal(isAppNavLinkActive("/settings/billing", "/settings/billing"), true);
    assert.equal(isAppNavLinkActive("/settings/billing", "/settings/business"), false);
    assert.equal(isAppNavLinkActive("/quote-requests/abc", "/quote-requests"), true);
  });

  it("QR dialog is labelled, described and closable", () => {
    assert.match(cardSource, /aria-labelledby=\{titleId\}/);
    assert.match(cardSource, /aria-describedby=\{descriptionId\}/);
    assert.match(cardSource, /aria-label="Close QR code"/);
    assert.match(cardSource, /e\.key === "Escape"/);
    assert.match(cardSource, /aria-live="polite"/);
    assert.match(cardSource, /htmlFor=\{phoneInputId\}/);
  });
});

describe("E. no-job state leads with Get More Work", () => {
  it("renders the card before the Ready to start a job card", () => {
    const cardIdx = dashboardSource.indexOf("<GetMoreWorkCard");
    const emptyIdx = dashboardSource.indexOf("{hasNoJobs ? <DashboardEmptyOnboarding /> : null}");
    assert.ok(cardIdx > 0 && emptyIdx > cardIdx);
    assert.match(dashboardSource, /variant=\{hasNoJobs \? "prominent" : "compact"\}/);
  });

  it("uses the approved copy and removes the old headline", () => {
    assert.match(cardSource, /Get more work/);
    assert.match(cardSource, /uppercase/);
    assert.match(cardSource, /Get your next job/);
    assert.match(
      cardSource,
      /Give customers an easy way to tell you what they need and request a quote\./
    );
    assert.doesNotMatch(emptyOnboardingSource, /Payment protection for contractors/);
    assert.doesNotMatch(emptyOnboardingSource, /Start protecting your first job/);
    assert.doesNotMatch(cardSource, /guarantee/i);
  });

  it("Ready to start a job card uses the approved copy", () => {
    assert.match(emptyOnboardingSource, /Ready to start a job\?/);
    assert.match(
      emptyOnboardingSource,
      /Create a job, document the work, get approvals, send invoices and keep everything in one\s+protected timeline\./
    );
  });
});

describe("F. send quote link uses the contractor URL", () => {
  it("builds the canonical public quote URL from the slug only", () => {
    assert.equal(buildPublicQuoteUrl(ORIGIN, "acme-painting"), QUOTE_URL);
    assert.equal(buildPublicQuoteUrl(`${ORIGIN}/`, " Acme-Painting "), QUOTE_URL);
    assert.equal(buildPublicQuoteUrl(ORIGIN, null), null);
    assert.equal(buildPublicQuoteUrl(ORIGIN, "  "), null);
    assert.equal(buildPublicQuoteUrl(ORIGIN, "a?b"), `${ORIGIN}/quote/a%3Fb`);
  });

  it("dashboard derives the URL from the profile slug and app origin", () => {
    assert.match(
      dashboardSource,
      /buildPublicQuoteUrl\(resolveAppUrl\(\), profile\?\.quote_slug\)/
    );
    assert.match(settingsFormSource, /buildPublicQuoteUrl\(appOrigin, quoteSlug\)/);
  });

  it("prefills a short, friendly SMS with the quote URL", () => {
    const message = buildQuoteLinkMessage({ businessName: "Acme Painting", quoteUrl: QUOTE_URL });
    assert.equal(
      message,
      `Hi, it's Acme Painting. Tell us what you need and request a quote here: ${QUOTE_URL}`
    );
    assert.ok(message.length <= 160);
    assert.equal(
      buildQuoteLinkMessage({ businessName: "  ", quoteUrl: QUOTE_URL }),
      `Hi! Tell us what you need and request a quote here: ${QUOTE_URL}`
    );
    const href = buildSmsHref("4165550123", message);
    assert.ok(href.startsWith("sms:4165550123?&body="));
    assert.equal(decodeURIComponent(href.split("body=")[1]!), message);
  });

  it("validates the customer mobile number client-side", () => {
    assert.equal(normalizeCustomerMobileNumber("(416) 555-0123"), "4165550123");
    assert.equal(normalizeCustomerMobileNumber("+1 416.555.0123"), "+14165550123");
    assert.equal(normalizeCustomerMobileNumber("555-0123"), null);
    assert.equal(normalizeCustomerMobileNumber("call me"), null);
    assert.equal(normalizeCustomerMobileNumber(""), null);
  });

  it("opens the device messages app (no server-side SMS send)", () => {
    assert.match(cardSource, /window\.location\.href = buildSmsHref\(normalized, message\)/);
    assert.match(cardSource, /Send quote link/);
    assert.doesNotMatch(cardSource, /twilio|sendTwilioSms|fetch\(/i);
  });
});

describe("G. copy link uses the contractor URL", () => {
  it("copies exactly the quote URL", () => {
    assert.match(cardSource, /const ok = await copyText\(quoteUrl\);/);
    assert.match(cardSource, /Copy link/);
  });
});

describe("H. QR code uses the contractor URL", () => {
  it("encodes the quote URL with the existing qrcode library", () => {
    assert.match(cardSource, /import\("qrcode"\)/);
    assert.match(cardSource, /toDataURL\(quoteUrl,/);
    assert.match(cardSource, /Customers can scan this code to request a quote from you\./);
    assert.match(cardSource, /Show QR code/);
  });
});

describe("I. share uses the contractor URL", () => {
  it("shares the quote URL and falls back to copy", () => {
    assert.match(cardSource, /navigator\.share\(\{ title: "Request a quote", text: message, url: quoteUrl \}\)/);
    assert.match(cardSource, /link was copied instead/);
  });

  it("puts no internal IDs or customer data in the URL", () => {
    const url = buildPublicQuoteUrl(ORIGIN, "acme-painting")!;
    assert.equal(new URL(url).search, "");
    assert.doesNotMatch(cardSource, /profile\.id|contractorId|user_id/);
    assert.doesNotMatch(dashboardSource, /quoteUrl=\{[^}]*profile\.id/);
  });

  it("links contractors without a slug to quote-request setup", () => {
    assert.equal(QUOTE_REQUEST_SETTINGS_PATH, "/settings/quote-requests");
    assert.match(cardSource, /Set up your quote link/);
  });
});

describe("J. Create Job remains", () => {
  it("keeps Create a job in the empty state and Create job on the job list", () => {
    assert.match(emptyOnboardingSource, /href="\/jobs\/create"[\s\S]*Create a job/);
    assert.match(dashboardSource, /href="\/jobs\/create"[\s\S]*Create job/);
    assert.match(emptyOnboardingSource, /trackStarted\("dashboard_create_first_job_cta"\)/);
  });
});

describe("K. View Sample Job remains", () => {
  it("keeps the sample job action and its tracking", () => {
    assert.match(emptyOnboardingSource, /View sample job/);
    assert.match(emptyOnboardingSource, /trackSampleJobViewedAction\(\)/);
    assert.match(emptyOnboardingSource, /<ProtectedJobSampleCard \/>/);
  });
});

describe("L. Money Overview remains", () => {
  it("still renders the receivables overview", () => {
    assert.match(dashboardSource, /<MoneyOverviewSection data=\{receivables\} \/>/);
  });
});

describe("M. existing users still see Get More Work", () => {
  it("renders the card unconditionally with the compact variant for users with jobs", () => {
    assert.doesNotMatch(dashboardSource, /hasNoJobs \? <GetMoreWorkCard|hasNoJobs && <GetMoreWorkCard/);
    assert.match(cardSource, /const compact = variant === "compact"/);
  });
});

describe("N. no billing, Partner or GA4 regressions", () => {
  it("dashboard still runs the Stripe return sync", () => {
    assert.match(dashboardSource, /await syncSubscriptionAfterStripeReturn\(\{/);
  });

  it("layout keeps the Partner Portal eligibility check", () => {
    assert.match(layoutSource, /\.from\("partners"\)[\s\S]*\.eq\("profile_id", profile\.id\)/);
    assert.match(layoutSource, /\.ilike\("email", email\)/);
    assert.match(layoutSource, /showPartnerPortal=\{showPartnerPortal\}/);
    assert.match(layoutSource, /<TrialStatusBanner profile=\{profile\}/);
  });

  it("new UI adds no GA4 events and touches no billing code", () => {
    for (const source of [mobileNavSource, cardSource, emptyOnboardingSource]) {
      assert.doesNotMatch(source, /gtag|trackGa4|ga4|stripe|checkout|partner-ref/i);
    }
  });
});
