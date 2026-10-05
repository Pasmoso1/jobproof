import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Home, { metadata as homeMetadata } from "@/app/page";
import SampleQuotePage, { metadata as sampleMetadata } from "@/app/sample-quote/page";
import {
  ContractorAcquisitionCtaLink,
  SampleQuoteCtaLink,
} from "@/components/contractor-funnel-trackers";
import {
  CONTRACTOR_CONVERSION_FUNNEL,
  GA4_FUNNEL_EVENTS,
  clearGa4OnceFiredForTests,
} from "@/lib/ga4";
import {
  GA4_TRIAL_STARTED_PENDING_COOKIE,
  normalizeTrialStartedMarkerValue,
} from "@/lib/ga4-trial-started-marker";
import { getPublicPlanPriceLine } from "@/lib/billing-plan-display";
import {
  SAMPLE_QUOTE_CONTRACTOR,
  SAMPLE_QUOTE_PATH,
  SAMPLE_QUOTE_PROPOSAL,
} from "@/lib/sample-quote";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const homeHtml = renderToStaticMarkup(createElement(Home));
const sampleHtml = renderToStaticMarkup(createElement(SampleQuotePage));

type Anchor = { href: string; className: string; text: string; index: number };

function anchors(html: string): Anchor[] {
  const out: Anchor[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const attrs = match[1];
    out.push({
      href: /href="([^"]*)"/.exec(attrs)?.[1] ?? "",
      className: /class="([^"]*)"/.exec(attrs)?.[1] ?? "",
      text: match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
      index: match.index,
    });
  }
  return out;
}

function hasClassToken(className: string, token: string) {
  return className.split(/\s+/).includes(token);
}

type GtagCall = unknown[];

function installBrowserMocks(cookie = "") {
  const store = new Map<string, string>();
  const gtagCalls: GtagCall[] = [];
  const metaCalls: unknown[][] = [];
  const storage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  (globalThis as { window?: unknown }).window = {
    gtag: (...args: unknown[]) => gtagCalls.push(args),
    fbq: (...args: unknown[]) => metaCalls.push(args),
    sessionStorage: storage,
    localStorage: storage,
    location: { search: "", pathname: "/" },
  };
  (globalThis as { document?: { cookie: string } }).document = { cookie };
  return { gtagCalls, metaCalls };
}

function removeBrowserMocks() {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { document?: unknown }).document;
}

describe("landing hero", () => {
  it("leads with winning more jobs instead of the old headline", () => {
    assert.match(homeHtml, /<h1[^>]*>Win more of the jobs you quote\.<\/h1>/);
    assert.doesNotMatch(homeHtml, /From first inquiry to signed quote/);
    assert.match(
      homeHtml,
      /Turn customer inquiries into professional quotes—and professional quotes into paying\s+jobs\./
    );
    assert.match(homeHtml, /JobProof gives you one place to capture customer requests/);
  });

  it("keeps the primary trial CTA dominant with the no-card note directly under it", () => {
    const heroEnd = homeHtml.indexOf("Why jobs slip away");
    const hero = anchors(homeHtml).filter((a) => a.index < heroEnd);
    const primary = hero.find((a) => a.text === "Start Your 14-Day Free Trial");
    const secondary = hero.find((a) => a.text.startsWith("See a Sample Quote"));
    assert.ok(primary && secondary);
    assert.equal(primary.href, "/signup");
    assert.equal(secondary.href, SAMPLE_QUOTE_PATH);
    assert.ok(hasClassToken(primary.className, "bg-[#2436BB]"));
    assert.ok(!hasClassToken(secondary.className, "bg-[#2436BB]"));
    assert.ok(!hasClassToken(secondary.className, "border"));

    const note = "No credit card required. Cancel anytime during your trial.";
    const mobileNote = homeHtml.indexOf(note, primary.index);
    assert.ok(mobileNote > primary.index && mobileNote < secondary.index);
  });

  it("shows the brand promise near the hero and in the final CTA", () => {
    const heroEnd = homeHtml.indexOf("Why jobs slip away");
    const hero = homeHtml.slice(0, heroEnd);
    for (const part of ["Win More Jobs.", "Get Paid.", "Stay Protected."]) {
      assert.ok(hero.includes(part), part);
    }
    assert.match(homeHtml, /Win More Jobs\. Get Paid\. Stay Protected\./);
  });
});

describe("landing narrative and sections", () => {
  it("follows problem → demo → how it works → customer experience → protection → pricing → final CTA", () => {
    const order = [
      "Win more of the jobs you quote.",
      "Good jobs get lost between the first message and the quote.",
      "Show customers you&#x27;re ready for the job.",
      "How JobProof Works",
      "A quote your customers can say yes to.",
      "Get paid and stay protected.",
      "Simple, Transparent Pricing",
      "Ready to win more of the work you quote?",
    ];
    const positions = order.map((text) => {
      const at = homeHtml.indexOf(text);
      assert.ok(at >= 0, `missing: ${text}`);
      return at;
    });
    for (let i = 1; i < positions.length; i++) {
      assert.ok(positions[i] > positions[i - 1], `${order[i]} should follow ${order[i - 1]}`);
    }
  });

  it("replaces unsupported switch language with a neutral before/after comparison", () => {
    assert.doesNotMatch(homeHtml, /switch to JobProof|contractors switch|contractors choose/i);
    assert.match(homeHtml, /Before JobProof/);
    assert.match(homeHtml, /With JobProof/);
  });

  it("contains no testimonials, customer counts, ratings or popularity claims", () => {
    assert.doesNotMatch(
      homeHtml,
      /testimonial|trusted by|most popular|★★★|\b\d[\d,]*\+?\s+contractors\b|\d+%\s+(more|faster)/i
    );
  });

  it("shows the four-step product journey before pricing", () => {
    const pricingAt = homeHtml.indexOf('id="pricing"');
    for (const step of ["Customer request", "JobProof", "Professional quote", "Customer approval"]) {
      const at = homeHtml.indexOf(`${step}</span>`);
      assert.ok(at > 0 && at < pricingAt, step);
    }
    assert.match(homeHtml, /aria-hidden="true" class="pointer-events-none select-none/);
    assert.match(homeHtml, /<figcaption/);
  });

  it("lists the primary outcomes and keeps the seven-step workflow", () => {
    for (const outcome of [
      "Win more jobs",
      "Respond more professionally",
      "Make quoting easier",
      "Follow up consistently",
      "Give customers a better experience",
    ]) {
      assert.ok(homeHtml.includes(outcome), outcome);
    }
    const steps = homeHtml.match(/<h3 class="font-semibold leading-snug text-zinc-950">/g) ?? [];
    assert.equal(steps.length, 7);
  });
});

describe("landing CTAs", () => {
  it("sends every free-trial CTA to /signup and every sample CTA to the sample quote", () => {
    const all = anchors(homeHtml);
    const trial = all.filter((a) => /free trial/i.test(a.text));
    const sample = all.filter((a) => /sample quote/i.test(a.text));
    assert.ok(trial.length >= 5);
    assert.ok(sample.length >= 4);
    for (const a of trial) assert.equal(a.href, "/signup", a.text);
    for (const a of sample) assert.equal(a.href, SAMPLE_QUOTE_PATH, a.text);
  });

  it("final CTA has Start Your Free Trial, See a Sample Quote and the trial terms", () => {
    const final = homeHtml.slice(homeHtml.indexOf("Ready to win more of the work you quote?"));
    assert.match(final, />Start Your Free Trial</);
    assert.match(final, /See a Sample Quote/);
    assert.match(final, /14 days free\. No credit card required\./);
  });
});

describe("pricing is unchanged", () => {
  it("keeps Solo at $39 and Pro at $59 CAD/month + applicable taxes", () => {
    assert.equal(getPublicPlanPriceLine("essential", "standard"), "$39 CAD/month + applicable taxes");
    assert.equal(getPublicPlanPriceLine("professional", "standard"), "$59 CAD/month + applicable taxes");
    assert.ok(homeHtml.includes("$39 CAD/month + applicable taxes"));
    assert.ok(homeHtml.includes("$59 CAD/month + applicable taxes"));
    assert.match(homeHtml, /14-day free trial with no credit card required/);
  });

  it("keeps the comparison table, collapsed and without a fixed minimum width", () => {
    assert.match(homeHtml, /<details[^>]*>[\s\S]*Compare plans[\s\S]*<table/);
    assert.match(homeHtml, /Multiple Contractor Trades/);
    assert.doesNotMatch(read("src/app/page.tsx"), /min-w-\[/);
  });
});

describe("mobile layout guards", () => {
  it("uses no fixed widths wider than a small phone on the landing or sample pages", () => {
    for (const file of [
      "src/app/page.tsx",
      "src/components/landing/product-previews.tsx",
      "src/app/sample-quote/page.tsx",
      "src/app/sample-quote/sample-quote-response.tsx",
    ]) {
      for (const match of read(file).matchAll(/\b(?:min-)?w-\[(\d+)px\]/g)) {
        assert.ok(Number(match[1]) <= 320, `${file}: ${match[0]}`);
      }
    }
  });

  it("clips accidental horizontal overflow and stacks CTAs full-width on mobile", () => {
    assert.match(homeHtml, /^<div class="min-h-screen overflow-x-clip/);
    const primary = anchors(homeHtml).find((a) => a.text === "Start Your 14-Day Free Trial");
    assert.ok(primary && hasClassToken(primary.className, "w-full"));
    assert.ok(primary && hasClassToken(primary.className, "sm:w-auto"));
  });
});

describe("SEO metadata", () => {
  it("reflects the win-more-jobs positioning for Canadian contractors without stuffing", () => {
    const title = String(homeMetadata.title);
    const description = String(homeMetadata.description);
    assert.match(title, /Win More Jobs/);
    assert.match(title, /Canadian Contractors/);
    assert.match(description, /Canadian contractors/);
    assert.ok(description.length <= 170, `description is ${description.length} chars`);
    assert.ok((description.match(/contractor/gi) ?? []).length <= 2);
  });

  it("keeps the sample quote out of search results", () => {
    assert.deepEqual(sampleMetadata.robots, { index: false, follow: true });
  });
});

describe("sample quote", () => {
  it("is clearly labelled as a sample with fictional data", () => {
    assert.match(sampleHtml, /This is a sample quote\./);
    assert.match(sampleHtml, /nothing you do on this page is sent or saved/);
    assert.match(sampleHtml, />Sample</);
    assert.match(SAMPLE_QUOTE_CONTRACTOR.phone, /555-01\d\d/);
    assert.match(SAMPLE_QUOTE_CONTRACTOR.email, /@example\.com$/);
  });

  it("shows business identity, job details, scope, pricing, terms and the response options", () => {
    for (const heading of [
      "Contractor",
      "Project overview",
      "Scope of work",
      "What&#x27;s included",
      "What&#x27;s not included",
      "Pricing",
      "Timeline",
      "Warranty",
      "Questions or changes",
      "Accept / Request Changes / Decline",
    ]) {
      assert.ok(sampleHtml.includes(`>${heading}</h2>`), heading);
    }
    assert.ok(sampleHtml.includes(SAMPLE_QUOTE_CONTRACTOR.businessName.replace("&", "&amp;")));
    assert.match(sampleHtml, /Property address/);
    assert.match(sampleHtml, />Accept Quote</);
  });

  it("has internally consistent pricing with Ontario HST", () => {
    const p = SAMPLE_QUOTE_PROPOSAL;
    const itemsTotal = p.pricingItems.reduce((sum, item) => sum + item.amount, 0);
    assert.equal(itemsTotal, p.subtotal);
    assert.equal(p.taxAmount, Math.round(p.subtotal * 0.13 * 100) / 100);
    assert.equal(p.total, p.subtotal + p.taxAmount);
    assert.equal(p.taxRateLabel, "13% (Ontario)");
    assert.ok(sampleHtml.includes("13,560.00"));
  });

  it("offers Create Quotes Like This → signup and a way back to the landing page", () => {
    const links = anchors(sampleHtml);
    const create = links.filter((a) => a.text === "Create Quotes Like This");
    assert.ok(create.length >= 2);
    for (const a of create) assert.equal(a.href, "/signup");
    assert.ok(links.some((a) => a.href === "/" && /Back to JobProof/.test(a.text)));
  });

  it("cannot create records: no server actions, network calls or posting forms", () => {
    const sources = [
      read("src/app/sample-quote/page.tsx"),
      read("src/app/sample-quote/sample-quote-response.tsx"),
      read("src/lib/sample-quote.ts"),
    ].join("\n");
    assert.doesNotMatch(
      sources,
      /"use server"|@\/lib\/supabase|createServiceRoleClient|public-estimate-actions|fetch\(|action=\{|formAction|\/api\//
    );
    assert.doesNotMatch(sampleHtml, /<form[^>]*\baction=/);
    assert.doesNotMatch(sampleHtml, /method="post"/i);

    const response = read("src/app/sample-quote/sample-quote-response.tsx");
    const forms = response.match(/<form\b[^>]*>/g) ?? [];
    assert.equal(forms.length, 2);
    for (const form of forms) assert.match(form, /onSubmit=/);
    assert.match(response, /event\.preventDefault\(\)/);
    assert.doesNotMatch(read("src/app/sample-quote/page.tsx"), /\/estimate\/sample\/pdf|hasPdf=\{true\}/);
  });
});

describe("conversion funnel analytics", () => {
  let gtagCalls: GtagCall[] = [];
  let metaCalls: unknown[][] = [];

  beforeEach(() => {
    const mocks = installBrowserMocks();
    gtagCalls = mocks.gtagCalls;
    metaCalls = mocks.metaCalls;
    clearGa4OnceFiredForTests();
  });

  afterEach(removeBrowserMocks);

  it("maps every requested funnel stage to a single, defined GA4 event", () => {
    assert.deepEqual(
      CONTRACTOR_CONVERSION_FUNNEL.map((s) => s.stage),
      [
        "landing_page_view",
        "sample_quote_view",
        "sample_quote_cta_click",
        "trial_cta_click",
        "signup_page_view",
        "signup_started",
        "signup_completed",
        "trial_started",
      ]
    );
    const defined = new Set<string>(Object.values(GA4_FUNNEL_EVENTS));
    const events = CONTRACTOR_CONVERSION_FUNNEL.map((s) => s.event);
    for (const event of events) assert.ok(defined.has(event), event);
    assert.equal(new Set(events).size, events.length);
    assert.equal("landing_page_view" in GA4_FUNNEL_EVENTS, false);
    assert.equal("trial_cta_click" in GA4_FUNNEL_EVENTS, false);
    assert.equal("signup_page_view" in GA4_FUNNEL_EVENTS, false);
    assert.equal("signup_completed" in GA4_FUNNEL_EVENTS, false);
  });

  it("sample quote CTA fires sample_quote_cta_click only, never a trial click", () => {
    const link = SampleQuoteCtaLink({
      href: SAMPLE_QUOTE_PATH,
      ctaText: "See a Sample Quote",
      ctaLocation: "hero",
      children: "See a Sample Quote",
    }) as ReactElement<{ onClick: () => void }>;
    link.props.onClick();
    assert.deepEqual(gtagCalls.map((c) => c[1]), ["sample_quote_cta_click"]);
    const params = gtagCalls[0][2] as Record<string, unknown>;
    assert.equal(params.cta_location, "hero");
    assert.equal(params.destination, SAMPLE_QUOTE_PATH);
    assert.equal(metaCalls.length, 0);
  });

  it("trial CTA fires contractor_cta_click only; a click is never a signup or trial", () => {
    const link = ContractorAcquisitionCtaLink({
      href: "/signup",
      ctaText: "Create Quotes Like This",
      ctaLocation: "sample_quote_footer",
      children: "Create Quotes Like This",
    }) as ReactElement<{ onClick: () => void }>;
    link.props.onClick();
    assert.deepEqual(gtagCalls.map((c) => c[1]), ["contractor_cta_click"]);
    assert.equal(metaCalls.length, 0);
  });

  it("landing and sample pages never fire signup or trial conversions", () => {
    const sources = [
      read("src/app/page.tsx"),
      read("src/app/sample-quote/page.tsx"),
      read("src/app/sample-quote/sample-quote-response.tsx"),
      read("src/components/contractor-funnel-trackers.tsx"),
      read("src/components/landing/product-previews.tsx"),
    ].join("\n");
    assert.doesNotMatch(
      sources,
      /sign_up|signup_start|trial_started|CompleteRegistration|StartTrial|trackMetaEvent/
    );
  });

  it("sample_quote_view fires once per tab session", async () => {
    const trackers = read("src/components/contractor-funnel-trackers.tsx");
    assert.match(trackers, /trackGa4EventOnce\(\s*"sample_quote_view",\s*GA4_FUNNEL_EVENTS\.sample_quote_view/);
    assert.match(read("src/app/sample-quote/page.tsx"), /<SampleQuoteViewTracker \/>/);
  });
});

describe("trial_started analytics", () => {
  afterEach(removeBrowserMocks);

  it("fires once, only when the server-set marker is present", async () => {
    const { consumeTrialStartedPendingAndTrack } = await import("@/lib/signup-funnel-analytics");

    const none = installBrowserMocks("");
    clearGa4OnceFiredForTests();
    assert.equal(consumeTrialStartedPendingAndTrack(), false);
    assert.equal(none.gtagCalls.length, 0);

    const mocks = installBrowserMocks(`${GA4_TRIAL_STARTED_PENDING_COOKIE}=professional`);
    clearGa4OnceFiredForTests();
    assert.equal(consumeTrialStartedPendingAndTrack(), true);
    assert.equal(consumeTrialStartedPendingAndTrack(), false);
    const trialCalls = mocks.gtagCalls.filter((c) => c[1] === "trial_started");
    assert.equal(trialCalls.length, 1);
    const params = trialCalls[0][2] as Record<string, unknown>;
    assert.equal(params.plan_tier, "professional");
    assert.equal(params.trial_length_days, 14);
    assert.equal(params.email, undefined);
    assert.equal(params.user_id, undefined);
    assert.equal(
      mocks.metaCalls.filter((c) => c[0] === "track" && c[1] === "StartTrial").length,
      1
    );
  });

  it("ignores unexpected marker values so nothing identifying can be forwarded", () => {
    assert.equal(normalizeTrialStartedMarkerValue("essential"), "essential");
    assert.equal(normalizeTrialStartedMarkerValue("1"), "1");
    assert.equal(normalizeTrialStartedMarkerValue("someone@example.com"), null);
    assert.equal(normalizeTrialStartedMarkerValue("3f9c2b1e-uuid"), null);
    assert.equal(normalizeTrialStartedMarkerValue(""), null);
  });

  it("is only marked after maybeStartManagedTrial actually starts the trial", () => {
    const appActions = read("src/app/(app)/actions.ts");
    assert.match(
      appActions,
      /const trialStarted = await maybeStartManagedTrial\([\s\S]*?\);\s*if \(trialStarted\) \{[\s\S]*?markTrialStartedAnalyticsPending/
    );
    const planActions = read("src/app/(app)/onboarding/plan/actions.ts");
    assert.match(
      planActions,
      /if \(result\.trialStarted\) \{\s*await markTrialStartedAnalyticsPending\(tier\);/
    );
    const startTrial = read("src/lib/start-managed-trial.ts");
    assert.doesNotMatch(startTrial, /markTrialStartedAnalyticsPending|jp_ga4_ts_pending/);
  });

  it("app shell consumes the marker on every navigation", () => {
    const layout = read("src/app/(app)/layout.tsx");
    assert.match(layout, /<TrialStartedPendingBridge \/>/);
    const bridge = read("src/components/contractor-onboarding-analytics.tsx");
    assert.match(
      bridge,
      /export function TrialStartedPendingBridge\(\)[\s\S]*?consumeTrialStartedPendingAndTrack\(\);\s*\}, \[pathname\]\);/
    );
  });
});
