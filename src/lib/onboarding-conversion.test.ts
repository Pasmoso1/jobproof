import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Never reach live services from these tests (no DB writes, emails or analytics inserts).
for (const key of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "RESEND_API_KEY",
]) {
  delete process.env[key];
}

import {
  formatTrialDaysRemainingLabel,
  isOnboardingCompleteForTrial,
  needsTrialActivation,
  resolveTrialPlanTier,
  type TrialLifecycleProfile,
} from "@/lib/trial-lifecycle";
import { resolveContractorPostLoginPath } from "@/lib/auth/post-login-path";
import {
  BUSINESS_DETAILS_REQUIRED_MESSAGE,
  getMissingBusinessDetails,
  isBusinessProfileCompleteForApp,
  validateOnboardingBusinessName,
} from "@/lib/validation/business-profile";
import { maybeStartManagedTrial, saveSelectedTrialPlan } from "@/lib/start-managed-trial";
import {
  ACTIVE_ACCOUNT_COUNTS,
  FULL_DASHBOARD_PATH,
  FULL_DASHBOARD_VIEW,
  GETTING_STARTED_DASHBOARD_PATH,
  loadDashboardActivityCounts,
  shouldOfferBackToGettingStarted,
  shouldShowFirstTimeDashboard,
} from "@/lib/dashboard-first-time";
import {
  BUSINESS_SETTINGS_FROM_DASHBOARD_PATH,
  FIRST_QUOTE_REQUEST_BODY,
  FIRST_QUOTE_REQUEST_TITLE,
  FIRST_TIME_DASHBOARD_HEADING,
  FIRST_TIME_DASHBOARD_INTRO,
  FULL_DASHBOARD_TRANSITION_NOTE,
  FirstTimeDashboard,
  MORE_QUOTE_REQUESTS_TITLE,
  PROFILE_CARD_BODY,
  PROFILE_CARD_CTA,
  PROFILE_CARD_TITLE,
  QUOTE_REQUEST_WORKFLOW,
  SAMPLE_JOB_CARD,
  SAMPLE_QUOTE_CARD,
  formatReceivedQuoteRequests,
  quoteRequestCardTitle,
} from "@/components/dashboard/first-time-dashboard";
import {
  ACTIVE_TRIAL_NO_CARD_NOTE,
  TRIAL_ENDING_SOON_NOTE,
  TrialStatusBanner,
  formatActiveTrialStatus,
} from "@/components/trial-status-banner";
import {
  BusinessDetailsNeededNotice,
  buildBusinessDetailsHref,
} from "@/components/business-details-needed-notice";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { resolveQuoteRequestShareContext } from "@/lib/quote-requests/share-context";
import { isPublicQuotePageReady } from "@/lib/quote-requests/readiness";
import { GA4_FUNNEL_EVENTS } from "@/lib/ga4";
import { PRIMARY_TRADE_HELP_TEXT } from "@/components/contractor/contractor-trades-services-fields";
import type { SupabaseClient } from "@supabase/supabase-js";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

type Op = { table: string; method: string; args: unknown[] };

/** Minimal chainable Supabase stand-in: records calls, returns scripted results for writes. */
function fakeSupabase(results: Array<{ data?: unknown; error?: { message: string } | null }>) {
  const ops: Op[] = [];
  const queue = [...results];
  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      const chain =
        (method: string) =>
        (...args: unknown[]) => {
          ops.push({ table, method, args });
          return builder;
        };
      for (const m of ["update", "eq", "is", "select", "insert"]) builder[m] = chain(m);
      builder.then = (resolve: (v: unknown) => unknown) =>
        resolve(queue.shift() ?? { data: null, error: null });
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, ops };
}

const PENDING_PROFILE = {
  id: "profile-1",
  beta_tester: false,
  stripe_subscription_id: null,
  subscription_status: "pending_trial",
  plan_tier: "essential",
  trial_plan_tier: "essential",
  trial_started_at: null,
  trial_ends_at: null,
  // Pre-set so no transactional email path runs in tests.
  trial_email_welcome_sent_at: "2026-10-01T00:00:00.000Z",
  trial_email_started_sent_at: "2026-10-01T00:00:00.000Z",
  business_name: "Green Construction",
  quote_primary_trade: "Roofing",
  phone: null,
  address_line_1: null,
  city: null,
  province: null,
  postal_code: null,
};

const ESTABLISHED_PROFILE = {
  ...PENDING_PROFILE,
  subscription_status: "trial",
  phone: "4165551212",
  address_line_1: "1 Main St",
  city: "Toronto",
  province: "ON",
  postal_code: "M5V1A1",
  trial_started_at: "2026-10-01T00:00:00.000Z",
  trial_ends_at: "2099-10-15T00:00:00.000Z",
  trial_expired_screen_seen_at: null,
};

describe("1–2. one-tap plan selection (Solo and Pro)", () => {
  const form = src("src/app/(app)/onboarding/plan/plan-selection-form.tsx");

  for (const tier of ["essential", "professional"] as const) {
    it(`saving ${tier} persists the plan without starting the trial`, async () => {
      const { client, ops } = fakeSupabase([{ data: [{ id: "profile-1" }], error: null }]);
      const result = await saveSelectedTrialPlan(
        client,
        { ...PENDING_PROFILE, subscription_status: null, plan_tier: null, trial_plan_tier: null },
        tier,
        "owner@example.com"
      );
      assert.deepEqual(result, { ok: true });
      const update = ops.find((o) => o.method === "update");
      const patch = update?.args[0] as Record<string, unknown>;
      assert.equal(patch.subscription_status, "pending_trial");
      assert.equal(patch.trial_plan_tier, tier);
      assert.equal(patch.trial_started_at, null, "selecting a plan never starts the trial");
      assert.deepEqual(
        ops.find((o) => o.method === "is")?.args,
        ["trial_started_at", null],
        "only applies while no trial has started"
      );
      assert.equal(ops.filter((o) => o.method === "update").length, 1);
    });
  }

  it("labels the actions Continue with Solo / Continue with Pro", () => {
    assert.match(form, /`Continue with \$\{plan\.name\}`/);
    assert.match(form, /name: "Solo"/);
    assert.match(form, /name: "Pro"/);
    assert.doesNotMatch(form, /Start with Solo|Start with Pro/);
  });

  it("advances on the first tap: navigation runs in a transition and the form stays locked", () => {
    assert.match(form, /startTransition\(\(\) => \{\s*router\.push\(result\.redirectTo\);/);
    assert.doesNotMatch(form, /router\.refresh\(\)/, "no competing refresh after push");
    assert.doesNotMatch(form, /finally\s*\{/, "loading is not reset before navigation commits");
    assert.match(form, /const busy = savingTier !== null \|\| isNavigating;/);
  });

  it("the plan action always continues to business setup and never touches the trial", () => {
    const actions = src("src/app/(app)/onboarding/plan/actions.ts");
    assert.match(actions, /return \{ success: true, redirectTo: BUSINESS_SETUP_PATH \};/);
    assert.doesNotMatch(actions, /maybeStartManagedTrial|markTrialStartedAnalyticsPending/);
  });
});

describe("3. plan-save failures", () => {
  it("database errors return a friendly error (no raw DB message)", async () => {
    const { client } = fakeSupabase([{ data: null, error: { message: "permission denied for table" } }]);
    const result = await saveSelectedTrialPlan(client, PENDING_PROFILE, "essential", "a@b.ca");
    assert.deepEqual(result, { ok: false, error: "Could not save your plan. Please try again." });
  });

  it("the form shows an accessible inline error and re-enables both plans", () => {
    const form = src("src/app/(app)/onboarding/plan/plan-selection-form.tsx");
    assert.match(form, /role="alert"/);
    assert.match(
      form,
      /catch \{\s*inFlight\.current = false;\s*setSavingTier\(null\);\s*setError\(\{ tier: planTier, message: PLAN_SAVE_ERROR \}\);/
    );
    assert.match(
      form,
      /if \(!result\.success\) \{\s*inFlight\.current = false;\s*setSavingTier\(null\);\s*setError\(\{ tier: planTier, message: result\.error \}\);/
    );
    assert.match(form, /error\?\.tier === plan\.tier/, "error renders beside the tapped plan");
  });
});

describe("4. double taps", () => {
  it("both plan buttons are disabled and a synchronous guard blocks a second request", () => {
    const form = src("src/app/(app)/onboarding/plan/plan-selection-form.tsx");
    assert.match(form, /if \(busy \|\| inFlight\.current\) return;\s*inFlight\.current = true;/);
    assert.match(form, /disabled=\{busy\}/);
    const business = src("src/app/(app)/onboarding/business-profile/onboarding-business-form.tsx");
    assert.match(business, /if \(busy \|\| inFlight\.current\) return;/);
  });

  it("a concurrent second activation is a no-op (conditional update matched no rows)", async () => {
    const { client, ops } = fakeSupabase([{ data: [], error: null }]);
    const started = await maybeStartManagedTrial(client, PENDING_PROFILE, "a@b.ca");
    assert.equal(started, false);
    const isFilter = ops.find((o) => o.method === "is");
    assert.deepEqual(isFilter?.args, ["trial_started_at", null]);
    assert.equal(ops.filter((o) => o.method === "update").length, 1, "no follow-up writes");
  });

  it("plan changes after activation are rejected by the conditional update", async () => {
    const { client, ops } = fakeSupabase([{ data: [], error: null }]);
    const result = await saveSelectedTrialPlan(client, PENDING_PROFILE, "professional", "a@b.ca");
    assert.equal(result.ok, false);
    assert.deepEqual(ops.find((o) => o.method === "is")?.args, ["trial_started_at", null]);
  });
});

describe("5. selected plan persists through navigation and refresh", () => {
  it("a chosen-but-not-activated plan keeps the user on onboarding with the plan remembered", () => {
    assert.equal(needsTrialActivation(PENDING_PROFILE), true);
    assert.equal(resolveTrialPlanTier(PENDING_PROFILE), "essential");
    assert.equal(resolveContractorPostLoginPath(PENDING_PROFILE), "/onboarding/business-profile");
  });

  it("the plan page stays reachable (Back / Change plan) until the trial starts", () => {
    const mw = src("src/middleware.ts");
    assert.match(mw, /!needsPlanSelection\(profile\) &&\s*!needsTrialActivation\(profile\)/);
    const page = src("src/app/(app)/onboarding/plan/page.tsx");
    assert.match(page, /const selectedTier = canChangePlan \? resolveTrialPlanTier\(profile\) : null;/);
    const business = src("src/app/(app)/onboarding/business-profile/page.tsx");
    assert.match(business, /← Change plan/);
  });

  it("pending accounts cannot use the app (no pending_trial write bypass)", () => {
    const mw = src("src/middleware.ts");
    assert.match(mw, /return !isOnboardingCompleteForTrial\(profile\) \|\| needsTrialActivation\(profile\);/);
  });
});

describe("6–8. trial activation requires only business name and primary trade", () => {
  it("6. business name + primary trade starts the trial", async () => {
    assert.equal(isOnboardingCompleteForTrial(PENDING_PROFILE), true);
    const { client, ops } = fakeSupabase([{ data: [{ id: "profile-1" }], error: null }]);
    const started = await maybeStartManagedTrial(client, PENDING_PROFILE, "a@b.ca");
    assert.equal(started, true);
    const patch = ops.find((o) => o.method === "update")?.args[0] as Record<string, unknown>;
    assert.equal(patch.subscription_status, "trial");
    assert.ok(patch.trial_started_at);
    const days =
      (Date.parse(String(patch.trial_ends_at)) - Date.parse(String(patch.trial_started_at))) / 86400000;
    assert.equal(Math.round(days), 14, "no extra trial days");
  });

  it("7. missing business name or primary trade blocks activation without writing", async () => {
    for (const profile of [
      { ...PENDING_PROFILE, business_name: "  " },
      { ...PENDING_PROFILE, quote_primary_trade: null },
    ]) {
      assert.equal(isOnboardingCompleteForTrial(profile), false);
      const { client, ops } = fakeSupabase([]);
      assert.equal(await maybeStartManagedTrial(client, profile, "a@b.ca"), false);
      assert.equal(ops.length, 0);
    }
    assert.equal(validateOnboardingBusinessName(""), "Business name is required.");
    assert.equal(validateOnboardingBusinessName("Acme"), null);
  });

  it("8. phone, address and other optional fields can stay empty (never fabricated)", () => {
    assert.deepEqual(getMissingBusinessDetails(PENDING_PROFILE), ["phone", "address"]);
    const action = src("src/app/(app)/onboarding/business-profile/actions.ts");
    const update = action.slice(action.indexOf(".update({"), action.indexOf("})", action.indexOf(".update({")));
    assert.doesNotMatch(update, /phone|address|city|province|postal|contact_email/);
    const form = src("src/app/(app)/onboarding/business-profile/onboarding-business-form.tsx");
    assert.doesNotMatch(form, /formData\.set\("(phone|address_line_1|city|province|postal_code)"/);
  });
});

describe("9–10. existing accounts", () => {
  it("9. completed profiles continue straight to the dashboard", () => {
    assert.equal(isOnboardingCompleteForTrial(ESTABLISHED_PROFILE), true);
    assert.equal(needsTrialActivation(ESTABLISHED_PROFILE), false);
    assert.equal(resolveContractorPostLoginPath(ESTABLISHED_PROFILE), "/dashboard");
    assert.equal(
      isBusinessProfileCompleteForApp({ ...ESTABLISHED_PROFILE, account_email: "a@b.ca" }),
      true
    );
  });

  it("10. an existing trial is never restarted or extended", async () => {
    const { client, ops } = fakeSupabase([]);
    assert.equal(await maybeStartManagedTrial(client, ESTABLISHED_PROFILE, "a@b.ca"), false);
    assert.equal(ops.length, 0);
    const blocked = await saveSelectedTrialPlan(client, ESTABLISHED_PROFILE, "professional", "a@b.ca");
    assert.equal(blocked.ok, false);
    const paid = { ...PENDING_PROFILE, stripe_subscription_id: "sub_123" };
    assert.equal(needsTrialActivation(paid), false);
    assert.equal(await maybeStartManagedTrial(client, paid, "a@b.ca"), false);
  });
});

describe("11. partner attribution survives onboarding", () => {
  it("trial activation still marks the partner referral and syncs the business name", () => {
    const start = src("src/lib/start-managed-trial.ts");
    assert.match(start, /markPartnerReferralTrialStarted\(admin, profile\.id\)/);
    assert.match(start, /syncPartnerReferralBusinessName\(/);
    const action = src("src/app/(app)/onboarding/business-profile/actions.ts");
    assert.match(action, /maybeStartManagedTrial\(supabase, nextProfile/);
    assert.match(action, /business_name: businessName,\s*quote_primary_trade: tradesResult\.data\.primaryTrade/);
  });

  it("onboarding_complete keeps the referral-presence flag (no partner code)", () => {
    const form = src("src/app/(app)/onboarding/business-profile/onboarding-business-form.tsx");
    assert.match(form, /partnerReferralPresent: Boolean\(readPartnerRefClient\(\)\)/);
  });
});

/** Head-count stand-in: per-table `{ count, error }` results, or a thrown error. */
function fakeCountSupabase(
  results: Record<string, { count?: number; error?: { code: string } } | "throw">
) {
  const tables: string[] = [];
  const client = {
    from(table: string) {
      tables.push(table);
      const result = results[table] ?? { count: 0 };
      const builder = {
        select: () => builder,
        eq: () => {
          if (result === "throw") throw new Error("network down");
          return Promise.resolve({ count: result.count ?? null, error: result.error ?? null });
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, tables };
}

describe("12–14. first-time dashboard transition", () => {
  const empty = { jobCount: 0, invoiceCount: 0, quoteRequestCount: 0 };

  it("a brand-new contractor sees getting started", () => {
    assert.equal(shouldShowFirstTimeDashboard(empty), true);
    assert.equal(shouldShowFirstTimeDashboard(empty, ""), true);
  });

  it("one or many quote requests keep getting started", () => {
    assert.equal(shouldShowFirstTimeDashboard({ ...empty, quoteRequestCount: 1 }), true);
    assert.equal(shouldShowFirstTimeDashboard({ ...empty, quoteRequestCount: 12 }), true);
  });

  it("estimates alone don't end getting started (they aren't even counted)", async () => {
    const { client, tables } = fakeCountSupabase({ estimates: { count: 3 } });
    const counts = await loadDashboardActivityCounts(client, "profile-1");
    assert.deepEqual(tables.sort(), ["invoices", "jobs", "quote_requests"]);
    assert.equal(shouldShowFirstTimeDashboard(counts), true);
  });

  it("the first job or the first invoice switches to the regular dashboard", async () => {
    assert.equal(shouldShowFirstTimeDashboard({ ...empty, jobCount: 1 }), false);
    assert.equal(shouldShowFirstTimeDashboard({ ...empty, invoiceCount: 1 }), false);
    assert.equal(shouldShowFirstTimeDashboard(ACTIVE_ACCOUNT_COUNTS), false);
    const withJob = await loadDashboardActivityCounts(
      fakeCountSupabase({ jobs: { count: 1 }, quote_requests: { count: 4 } }).client,
      "profile-1"
    );
    assert.equal(shouldShowFirstTimeDashboard(withJob), false);
    const withInvoice = await loadDashboardActivityCounts(
      fakeCountSupabase({ invoices: { count: 1 } }).client,
      "profile-1"
    );
    assert.equal(shouldShowFirstTimeDashboard(withInvoice), false);
  });

  it("?view=full always shows the regular dashboard", () => {
    assert.equal(shouldShowFirstTimeDashboard(empty, FULL_DASHBOARD_VIEW), false);
    assert.equal(shouldShowFirstTimeDashboard({ ...empty, quoteRequestCount: 2 }, "full"), false);
  });

  it("'Back to getting started' is offered only to contractors who still qualify", () => {
    assert.equal(shouldOfferBackToGettingStarted(empty, "full"), true);
    assert.equal(shouldOfferBackToGettingStarted({ ...empty, quoteRequestCount: 3 }, "full"), true);
    assert.equal(shouldOfferBackToGettingStarted(empty), false, "already on getting started");
    assert.equal(shouldOfferBackToGettingStarted({ ...empty, jobCount: 1 }, "full"), false);
    assert.equal(shouldOfferBackToGettingStarted({ ...empty, invoiceCount: 1 }, "full"), false);
    assert.equal(shouldOfferBackToGettingStarted({ ...empty, jobCount: null }, "full"), false);
    assert.equal(GETTING_STARTED_DASHBOARD_PATH, "/dashboard");
    const dashboard = src("src/app/(app)/dashboard/page.tsx");
    assert.match(
      dashboard,
      /\{offerBackToGettingStarted \? \(\s*<Link\s+href=\{GETTING_STARTED_DASHBOARD_PATH\}[\s\S]*?← Back to getting started/
    );
  });

  it("is derived from product data only, so it survives refresh, sign-out and other devices", async () => {
    const lib = src("src/lib/dashboard-first-time.ts");
    assert.doesNotMatch(lib, /cookies\(|next\/headers|localStorage|sessionStorage|document\./);
    const counts = { jobCount: 0, invoiceCount: 0, quoteRequestCount: 2 };
    const firstSession = shouldShowFirstTimeDashboard(counts);
    const secondSession = shouldShowFirstTimeDashboard({ ...counts });
    assert.equal(firstSession, true);
    assert.equal(secondSession, firstSession);
    const later = await loadDashboardActivityCounts(
      fakeCountSupabase({ jobs: { count: 1 } }).client,
      "profile-1"
    );
    assert.equal(shouldShowFirstTimeDashboard(later), false, "stays regular in every later session");
  });

  it("failed or thrown activity queries fall back to the regular dashboard", async () => {
    for (const failing of ["jobs", "invoices", "quote_requests"]) {
      const errored = await loadDashboardActivityCounts(
        fakeCountSupabase({ [failing]: { error: { code: "57014" } } }).client,
        "profile-1"
      );
      assert.equal(shouldShowFirstTimeDashboard(errored), false, `${failing} error`);
      assert.equal(shouldOfferBackToGettingStarted(errored, "full"), false);
      const thrown = await loadDashboardActivityCounts(
        fakeCountSupabase({ [failing]: "throw" }).client,
        "profile-1"
      );
      assert.equal(shouldShowFirstTimeDashboard(thrown), false, `${failing} throw`);
    }
  });

  it("the page only runs the extra counts when the regular loaders found no job or invoice", () => {
    const dashboard = src("src/app/(app)/dashboard/page.tsx");
    assert.match(
      dashboard,
      /profile\?\.id && hasNoJobs && !receivables\.hasAnyInvoice\s*\? await loadDashboardActivityCounts\(supabase, String\(profile\.id\)\)\s*: ACTIVE_ACCOUNT_COUNTS/
    );
  });

  it("links to received quote requests while keeping the first quote request card", () => {
    const html = renderToStaticMarkup(
      createElement(FirstTimeDashboard, {
        quoteUrl: "https://jobproof.ca/quote/green-construction",
        businessName: "Green Construction",
        missingProfileDetails: [],
        quoteRequestCount: 2,
      })
    );
    assert.match(html, /<h2[^>]*>Get more quote requests<\/h2>/);
    assert.ok(!html.includes(FIRST_QUOTE_REQUEST_TITLE));
    assert.ok(html.includes(FIRST_QUOTE_REQUEST_BODY), "supporting instructions unchanged");
    assert.match(html, />Send Quote Request</, "CTA unchanged");
    assert.match(html, /href="\/quote-requests"[^>]*>[\s\S]*?You&#x27;ve received 2 quote requests\. Review them/);
    assert.equal(formatReceivedQuoteRequests(1), "You've received 1 quote request. Review it");
    const none = renderToStaticMarkup(
      createElement(FirstTimeDashboard, {
        quoteUrl: "https://jobproof.ca/quote/x",
        businessName: null,
        missingProfileDetails: [],
      })
    );
    assert.doesNotMatch(none, /href="\/quote-requests"/);
    assert.match(none, /<h2[^>]*>Get your first quote request<\/h2>/);
  });

  it("the card heading switches at the first received quote request", () => {
    assert.equal(FIRST_QUOTE_REQUEST_TITLE, "Get your first quote request");
    assert.equal(MORE_QUOTE_REQUESTS_TITLE, "Get more quote requests");
    assert.equal(quoteRequestCardTitle(0), FIRST_QUOTE_REQUEST_TITLE);
    assert.equal(quoteRequestCardTitle(1), MORE_QUOTE_REQUESTS_TITLE);
    assert.equal(quoteRequestCardTitle(25), MORE_QUOTE_REQUESTS_TITLE);
    const html = renderToStaticMarkup(
      createElement(FirstTimeDashboard, {
        quoteUrl: "https://jobproof.ca/quote/x",
        businessName: null,
        missingProfileDetails: [],
        quoteRequestCount: 1,
      })
    );
    assert.match(html, /<h2[^>]*>Get more quote requests<\/h2>/);
    assert.match(html, /You&#x27;ve received 1 quote request\. Review it/);
  });

  it("counts quote requests customers actually submitted (any status), like the Quote Requests page", () => {
    const lib = src("src/lib/dashboard-first-time.ts");
    assert.match(lib, /headCount\(supabase, "quote_requests", "contractor_id", profileId\)/);
    const list = src("src/app/(app)/quote-requests/quote-request-actions.ts");
    assert.match(list, /\.from\("quote_requests"\)\s*\.select\("\*"\)\s*\.eq\("contractor_id", profileId\)/);
    const inserts = [
      "src/app/quote/[slug]/actions.ts",
      "src/app/(app)/quote-requests/quote-request-actions.ts",
      "src/lib/quote-request-share-analytics.ts",
    ].map((p) => (src(p).match(/from\("quote_requests"\)\.insert\(/g) ?? []).length);
    assert.deepEqual(inserts, [1, 0, 0], "only the public customer form creates rows");
  });

  it("12. renders the welcome, first quote request card and secondary actions", () => {
    assert.equal(shouldShowFirstTimeDashboard(empty), true);
    const html = renderToStaticMarkup(
      createElement(FirstTimeDashboard, {
        quoteUrl: "https://jobproof.ca/quote/green-construction",
        businessName: "Green Construction",
        missingProfileDetails: ["Business phone", "Business address"],
      })
    );
    assert.ok(html.includes(FIRST_TIME_DASHBOARD_HEADING));
    assert.ok(html.includes(FIRST_TIME_DASHBOARD_INTRO.replace("'", "&#x27;")));
    assert.ok(html.includes(FIRST_QUOTE_REQUEST_TITLE));
    assert.ok(html.includes(FIRST_QUOTE_REQUEST_BODY.replace("'", "&#x27;")));
    assert.match(html, />Send Quote Request</);
    assert.match(html, /href="\/sample-quote\?from=dashboard"[^>]*>View sample quote/);
    assert.match(html, /Explore a sample job/);
    assert.match(html, /Complete your business profile/);
    assert.match(html, /Still needed: business phone and business address\./);
    assert.equal(FULL_DASHBOARD_PATH, "/dashboard?view=full");
    assert.match(html, /href="\/dashboard\?view=full"[^>]*>View full dashboard/);
    assert.ok(html.includes(FULL_DASHBOARD_TRANSITION_NOTE));
    assert.doesNotMatch(html, /Money overview|Storage used|Active jobs/);
  });

  it("hides the profile prompt once the profile is complete", () => {
    const html = renderToStaticMarkup(
      createElement(FirstTimeDashboard, {
        quoteUrl: "https://jobproof.ca/quote/x",
        businessName: null,
        missingProfileDetails: [],
      })
    );
    assert.doesNotMatch(html, /Complete your business profile/);
  });

  it("13. the established-user dashboard is unchanged", () => {
    const dashboard = src("src/app/(app)/dashboard/page.tsx");
    assert.match(dashboard, /Welcome back\. Here&apos;s an overview of your jobs\./);
    assert.match(dashboard, /<GetMoreWorkCard/);
    assert.match(dashboard, /Recent jobs/);
  });

  it("14. financial information is never hidden when it exists", () => {
    assert.equal(shouldShowFirstTimeDashboard({ ...empty, invoiceCount: 1 }), false);
    const dashboard = src("src/app/(app)/dashboard/page.tsx");
    assert.match(
      dashboard,
      /receivables\.hasAnyInvoice \|\| dashboardView === FULL_DASHBOARD_VIEW \? \(\s*<MoneyOverviewSection data=\{receivables\} \/>/
    );
  });
});

describe("15–16. deferred profile completion", () => {
  it("15. notices link to Settings → Business with a safe return path", () => {
    assert.equal(buildBusinessDetailsHref("/jobs/abc"), "/settings/business?returnTo=%2Fjobs%2Fabc");
    const html = renderToStaticMarkup(
      createElement(BusinessDetailsNeededNotice, {
        missing: ["phone", "address"],
        returnTo: "/jobs/abc",
        action: "send contracts, change orders and invoices",
      })
    );
    assert.match(html, /Add your business phone and business address to send contracts/);
    assert.match(html, /appear on the documents your customers receive/);
    assert.match(html, /href="\/settings\/business\?returnTo=%2Fjobs%2Fabc"/);
    const page = src("src/app/(app)/settings/business/page.tsx");
    assert.match(page, /resolveSafeLoginRedirect\(params\.returnTo \?\? null, ""\)/);
    const form = src("src/app/(app)/settings/business/business-settings-form.tsx");
    assert.match(form, /\} else if \(returnTo\) \{\s*router\.push\(returnTo\);/);
  });

  it("16. contracts, change orders, invoices, reminders and estimate sends stay gated", () => {
    assert.equal(
      isBusinessProfileCompleteForApp({ ...PENDING_PROFILE, account_email: "a@b.ca" }),
      false
    );
    const actions = src("src/app/(app)/actions.ts");
    // Import + createOrUpdateContract, sendContractForSigning, sendChangeOrderForSigning,
    // createInvoice, resendInvoice, sendInvoiceReminder.
    assert.equal(actions.match(/BUSINESS_DETAILS_REQUIRED_MESSAGE/g)?.length ?? 0, 7);
    const estimates = src("src/app/(app)/estimates/estimate-actions.ts");
    assert.match(estimates, /error:\s*BUSINESS_DETAILS_REQUIRED_MESSAGE/);
    assert.match(src("src/lib/invoice-reminder-cron.ts"), /isBusinessProfileCompleteForApp/);
    assert.match(BUSINESS_DETAILS_REQUIRED_MESSAGE, /phone and address/);
    const billing = src("src/lib/stripe-subscription-tax.ts");
    assert.match(billing, /Complete your business address/, "subscription tax still needs the address");
  });
});

describe("17. analytics names and dedupe", () => {
  it("keeps existing event names and adds onboarding_plan_selected", () => {
    for (const name of [
      "sign_up",
      "signup_verified",
      "onboarding_start",
      "onboarding_complete",
      "trial_started",
    ]) {
      assert.equal((GA4_FUNNEL_EVENTS as Record<string, string>)[name], name);
    }
    assert.equal(GA4_FUNNEL_EVENTS.onboarding_plan_selected, "onboarding_plan_selected");
  });

  it("onboarding pages keep their trackers; onboarding_complete stays once-per-session", () => {
    const business = src("src/app/(app)/onboarding/business-profile/page.tsx");
    assert.match(business, /<SignupVerifiedTracker confirmed=\{confirmed\} \/>/);
    assert.match(business, /<OnboardingStartTracker step="business_profile" \/>/);
    const form = src("src/app/(app)/onboarding/business-profile/onboarding-business-form.tsx");
    assert.match(form, /trackGa4EventOnce\(\s*"onboarding_complete",/);
    assert.doesNotMatch(src("src/app/(app)/settings/business/business-settings-form.tsx"), /onboarding_complete/);
  });

  it("dashboard visits to the sample quote don't count as acquisition traffic", () => {
    const view = src("src/app/sample-quote/sample-quote-view.tsx");
    assert.match(view, /\{fromDashboard \? null : <SampleQuoteViewTracker \/>\}/);
    const response = src("src/app/sample-quote/sample-quote-response.tsx");
    assert.match(response, /fromDashboard \? \(\s*<Link href="\/dashboard"/);
  });
});

describe("18. compact mobile onboarding", () => {
  it("one logo (app header) — onboarding pages don't repeat it", () => {
    assert.doesNotMatch(src("src/app/(app)/onboarding/plan/page.tsx"), /JobProofLogo/);
    assert.doesNotMatch(src("src/app/(app)/onboarding/business-profile/page.tsx"), /JobProofLogo/);
    assert.match(src("src/app/(app)/layout.tsx"), /<HideOnOnboarding>/);
  });

  it("uses the requested copy and an accessible step indicator", () => {
    const plan = src("src/app/(app)/onboarding/plan/page.tsx");
    assert.match(plan, /Choose your plan/);
    assert.match(plan, /Try JobProof free for 14 days\. No credit card required\./);
    const business = src("src/app/(app)/onboarding/business-profile/page.tsx");
    assert.match(business, /Tell us about your business/);
    assert.match(business, /Just two details to get started\. You can complete your profile later\./);
    const form = src("src/app/(app)/onboarding/business-profile/onboarding-business-form.tsx");
    assert.match(form, /"Start my 14-day free trial"/);
    assert.match(form, /No credit card required\./);
    const step1 = renderToStaticMarkup(createElement(OnboardingProgress, { step: 1 }));
    const step2 = renderToStaticMarkup(createElement(OnboardingProgress, { step: 2 }));
    assert.match(step1, /aria-label="Onboarding progress"/);
    assert.match(step1, /Step 1 of 2 — Choose your plan/);
    assert.match(step2, /Step 2 of 2 — Business setup/);
  });

  it("no fixed widths that could overflow a 360px screen; tap targets ≥ 44px", () => {
    for (const file of [
      "src/app/(app)/onboarding/plan/plan-selection-form.tsx",
      "src/app/(app)/onboarding/business-profile/onboarding-business-form.tsx",
      "src/components/dashboard/first-time-dashboard.tsx",
      "src/components/onboarding/onboarding-progress.tsx",
    ]) {
      const s = src(file);
      assert.doesNotMatch(s, /\b(min-)?w-\[(3[6-9]\d|[4-9]\d\d)px\]/, file);
      assert.doesNotMatch(s, /whitespace-nowrap/, file);
    }
    assert.match(src("src/app/(app)/onboarding/plan/plan-selection-form.tsx"), /min-h-12 w-full/);
    const signup = src("src/app/(auth)/signup/page.tsx");
    const checkEmail = signup.slice(signup.indexOf('postSubmitView === "new_user_check_email"'));
    assert.match(checkEmail, /items-center bg-zinc-50 px-4 py-6 sm:justify-center/);
    assert.match(checkEmail, /className="break-all text-zinc-900">\{email\}/);
  });

  it("trade copy explains question tailoring, not lead matching", () => {
    assert.equal(
      PRIMARY_TRADE_HELP_TEXT,
      "Your trade helps JobProof ask customers the right questions about their projects, so you receive more useful details before preparing a quote."
    );
    const fields = src("src/components/contractor/contractor-trades-services-fields.tsx");
    assert.doesNotMatch(fields, /match quote requests|for matching/);
    assert.match(fields, /tailor the questions\s+customers answer in your quote requests/);
  });
});

describe("19. quote-request sharing", () => {
  it("works right after two-field onboarding", () => {
    const profile = {
      business_name: "Green Construction",
      quote_primary_trade: "Roofing",
      phone: null,
      quote_slug: "green-construction",
    };
    assert.deepEqual(resolveQuoteRequestShareContext(profile, "https://jobproof.ca"), {
      quoteUrl: "https://jobproof.ca/quote/green-construction",
      businessName: "Green Construction",
    });
    assert.equal(isPublicQuotePageReady(profile), true);
  });

  it("first-time dashboard reuses the existing Send Quote Request flow", () => {
    const view = src("src/components/dashboard/first-time-dashboard.tsx");
    assert.match(view, /<SendQuoteRequestButton[\s\S]*?sourceLocation="dashboard"/);
    assert.match(src("src/lib/validation/quote-request-settings.ts"), /Optional here/);
  });
});

describe("20. first-time dashboard UX", () => {
  const renderDashboard = (props: Partial<Parameters<typeof FirstTimeDashboard>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(FirstTimeDashboard, {
        quoteUrl: "https://jobproof.ca/quote/green-construction",
        businessName: "Green Construction",
        missingProfileDetails: ["Business phone", "Business address"],
        ...props,
      })
    );

  it("shows the four-step quote-request workflow inside the card, before the CTA", () => {
    assert.deepEqual(
      QUOTE_REQUEST_WORKFLOW.map((s) => s.label),
      [
        "Customer contacts you",
        "Send your quote-request link",
        "Customer provides details and photos",
        "Review the job and prepare your quote",
      ]
    );
    const html = renderDashboard();
    const list = html.match(/<ol aria-label="How a quote request works"[\s\S]*?<\/ol>/)?.[0] ?? "";
    assert.equal(list.match(/<li/g)?.length, 4);
    const listText = list.replace(/<[^>]+>/g, "");
    let last = -1;
    for (const step of QUOTE_REQUEST_WORKFLOW) {
      const at = listText.indexOf(step.label);
      assert.ok(at > last, `${step.label} in order`);
      last = at;
    }
    assert.ok(html.indexOf("</ol>") < html.indexOf(">Send Quote Request<"), "workflow sits above the CTA");
    assert.doesNotMatch(html, /<img|<video|animate-/, "no images or animations");
  });

  it("never suggests JobProof supplies the customers", () => {
    const html = renderDashboard();
    assert.doesNotMatch(html, /\bleads?\b|we(&#x27;ll| will) (find|send) you/i);
    assert.match(QUOTE_REQUEST_WORKFLOW[0].label, /Customer contacts you/);
  });

  it("keeps the Send Quote Request CTA full-width and tall on mobile", () => {
    const html = renderDashboard();
    const button = html.match(/<button[^>]*>Send Quote Request<\/button>/)?.[0] ?? "";
    assert.match(button, /min-h-12/);
    assert.match(button, /w-full/);
    assert.match(button, /sm:w-auto/);
  });

  it("sample quote and sample job are descriptive action cards on the existing routes", () => {
    assert.deepEqual(
      { ...SAMPLE_QUOTE_CARD },
      {
        title: "See a professional quote",
        body: "Preview the type of quote you can send to customers.",
        cta: "View sample quote",
        href: "/sample-quote?from=dashboard",
      }
    );
    assert.equal(SAMPLE_JOB_CARD.title, "Explore a sample job");
    assert.equal(
      SAMPLE_JOB_CARD.body,
      "See how JobProof organizes project details, photos, approvals, and records."
    );
    assert.equal(SAMPLE_JOB_CARD.cta, "Explore sample job");
    const html = renderDashboard();
    assert.match(html, /<h3[^>]*>See a professional quote<\/h3>/);
    assert.match(html, /<h3[^>]*>Explore a sample job<\/h3>/);
    assert.match(
      html,
      /<button type="button" aria-expanded="false" aria-controls="first-time-sample-job"[^>]*>Explore sample job/
    );
    assert.match(html, /class="grid gap-3 sm:grid-cols-2"/, "stacked on mobile, side by side from sm");
    const view = src("src/components/dashboard/first-time-dashboard.tsx");
    assert.match(view, /<ProtectedJobSampleCard id="first-time-sample-job" \/>/);
    assert.match(view, /trackSampleJobViewedAction\(\)/, "sample job analytics unchanged");
    assert.doesNotMatch(view, /\.insert\(|createClient/, "no records are created");
  });

  it("the profile card explains the trial is active and details are only needed for documents", () => {
    assert.equal(PROFILE_CARD_TITLE, "Complete your business profile");
    assert.equal(
      PROFILE_CARD_BODY,
      "Add your business contact details so your quotes, contracts, and invoices are ready to send."
    );
    const html = renderDashboard();
    assert.match(html, /Still needed: business phone and business address\. No rush — your trial is already active\./);
    assert.match(
      html,
      new RegExp(`href="${BUSINESS_SETTINGS_FROM_DASHBOARD_PATH.replace(/[?]/g, "\\?")}"[^>]*>${PROFILE_CARD_CTA}`)
    );
    assert.doesNotMatch(html, /required to use|before you can use/i);
  });

  it("orders the page for mobile: welcome, card, workflow, CTA, samples, profile, full dashboard", () => {
    const html = renderDashboard();
    const order = [
      FIRST_TIME_DASHBOARD_HEADING,
      FIRST_QUOTE_REQUEST_TITLE,
      "How a quote request works",
      ">Send Quote Request<",
      SAMPLE_QUOTE_CARD.title,
      SAMPLE_JOB_CARD.title,
      PROFILE_CARD_TITLE,
      "View full dashboard",
    ].map((needle) => html.indexOf(needle));
    assert.ok(order.every((at) => at >= 0), "every section renders");
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });

  it("all card actions cover the full card and stay within a 360px screen", () => {
    const view = src("src/components/dashboard/first-time-dashboard.tsx");
    assert.match(view, /after:absolute after:inset-0/);
    assert.doesNotMatch(view, /\b(min-)?w-\[(3[6-9]\d|[4-9]\d\d)px\]|whitespace-nowrap/);
  });
});

describe("21. trial status banner", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const trialProfile = (startedDaysAgo: number, extra: Partial<TrialLifecycleProfile> = {}) => {
    const started = Date.now() - startedDaysAgo * DAY - 60_000;
    return {
      subscription_status: "trial",
      trial_plan_tier: "essential",
      plan_tier: "essential",
      business_name: "Green Construction",
      quote_primary_trade: "Roofing",
      trial_started_at: new Date(started).toISOString(),
      trial_ends_at: new Date(started + 14 * DAY).toISOString(),
      ...extra,
    } satisfies TrialLifecycleProfile;
  };
  const render = (profile: TrialLifecycleProfile) =>
    renderToStaticMarkup(createElement(TrialStatusBanner, { profile }));

  it("counts down from the real trial dates instead of a fixed 14", () => {
    assert.match(render(trialProfile(0)), /Your free trial is active — 14 days remaining\./);
    assert.match(render(trialProfile(4)), /Your free trial is active — 10 days remaining\./);
    assert.match(render(trialProfile(9)), /Your free trial is active — 5 days remaining\./);
    assert.equal(formatActiveTrialStatus(1), "Your free trial is active — 1 day remaining.");
    assert.doesNotMatch(src("src/components/trial-status-banner.tsx"), /\b14\b/);
  });

  it("says no credit card is required only while the card-free trial is active", () => {
    const active = render(trialProfile(2));
    assert.ok(active.includes(ACTIVE_TRIAL_NO_CARD_NOTE));
    assert.match(active, /emerald/, "calm colour while active");
    assert.doesNotMatch(active, /amber|red-/);

    const paid = render(
      trialProfile(2, { subscription_status: "active", stripe_subscription_id: "sub_123" })
    );
    assert.equal(paid, "", "linked subscriptions show no trial banner");
    const expired = render(trialProfile(20));
    assert.doesNotMatch(expired, /no credit card/);
    assert.match(expired, /Your free trial has ended/);
    const ending = render(trialProfile(12));
    assert.doesNotMatch(ending, /no credit card/);
  });

  it("keeps the amber subscribe prompt for the final days", () => {
    const ending = render(trialProfile(11));
    assert.match(ending, /Your free trial is active — 3 days remaining\./);
    assert.ok(ending.includes(TRIAL_ENDING_SOON_NOTE));
    assert.match(ending, /amber/);
    assert.match(ending, /href="\/settings\/billing"[^>]*>Subscribe Now/);
    assert.match(render(trialProfile(13)), /1 day remaining\./);
  });

  it("leaves pending setup, expiry and the billing page label unchanged", () => {
    const pending = render({
      subscription_status: "pending_trial",
      trial_plan_tier: "essential",
      business_name: "",
      quote_primary_trade: "",
    });
    assert.match(pending, /Continue setup/);
    assert.match(render(trialProfile(20)), /Subscribe Now/);
    assert.equal(formatTrialDaysRemainingLabel(10), "10 days remaining");
    assert.equal(formatTrialDaysRemainingLabel(1), "Last day of your trial");
  });
});
