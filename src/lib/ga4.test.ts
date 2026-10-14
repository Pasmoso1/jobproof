import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GA4_FUNNEL_EVENTS,
  buildAcquisitionContext,
  classifySignupError,
  clearGa4OnceFiredForTests,
  sanitizeGa4Params,
  trackGa4Event,
  trackGa4EventOnce,
} from "@/lib/ga4";

type GtagCall = unknown[];

function installBrowserMocks() {
  const store = new Map<string, string>();
  const gtagCalls: GtagCall[] = [];
  const gtag = (...args: unknown[]) => {
    gtagCalls.push(args);
  };

  const storage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
  };

  (globalThis as { window?: unknown; document?: unknown }).window = {
    gtag,
    sessionStorage: storage,
    localStorage: storage,
    location: { search: "", pathname: "/signup", hostname: "www.jobproof.ca" },
  };
  (globalThis as { document?: { cookie: string } }).document = { cookie: "" };

  return { gtagCalls, sessionStorage: storage };
}

describe("GA4 helper", () => {
  let gtagCalls: GtagCall[] = [];

  beforeEach(() => {
    const mocks = installBrowserMocks();
    gtagCalls = mocks.gtagCalls;
    clearGa4OnceFiredForTests();
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { document?: unknown }).document;
  });

  it("safely no-ops without gtag", () => {
    const sessionStorage = (globalThis as { window: { sessionStorage: Storage } }).window
      .sessionStorage;
    (globalThis as { window: { sessionStorage: Storage } }).window = { sessionStorage };
    assert.equal(trackGa4Event("signup_view", { utm_source: "ig" }), false);
  });

  it("safely no-ops without window (SSR)", () => {
    delete (globalThis as { window?: unknown }).window;
    assert.equal(trackGa4Event("signup_view"), false);
    assert.equal(trackGa4EventOnce("signup_view", "signup_view"), false);
  });

  it("fires events through existing gtag without embedding measurement ID", () => {
    const fired = trackGa4Event("contractor_landing_view", {
      utm_source: "facebook",
      email: "secret@example.com",
    });
    assert.equal(fired, true);
    assert.equal(gtagCalls.length, 1);
    assert.deepEqual(gtagCalls[0][0], "event");
    assert.deepEqual(gtagCalls[0][1], "contractor_landing_view");
    const params = gtagCalls[0][2] as Record<string, unknown>;
    assert.equal(params.utm_source, "facebook");
    assert.equal(params.email, undefined);

    const ga4Source = readFileSync(join(process.cwd(), "src/lib/ga4.ts"), "utf8");
    assert.doesNotMatch(ga4Source, /G-[A-Z0-9]+/);
  });

  it("dedupes once-per-session events", () => {
    assert.equal(trackGa4EventOnce("signup_view", "signup_view"), true);
    assert.equal(trackGa4EventOnce("signup_view", "signup_view"), false);
    assert.equal(trackGa4EventOnce("signup_start", "signup_start"), true);
    assert.equal(trackGa4EventOnce("signup_start", "signup_start"), false);
    assert.equal(gtagCalls.length, 2);
  });

  it("strips PII from payloads including partner codes", () => {
    const safe = sanitizeGa4Params({
      utm_campaign: "spring",
      email: "a@b.com",
      name: "Jane",
      phone: "555",
      user_id: "uuid",
      referral_code: "JP-AAAA11",
      partner_referral_present: true,
    });
    assert.deepEqual(safe, {
      utm_campaign: "spring",
      partner_referral_present: true,
    });
  });

  it("classifies signup errors into safe categories only", () => {
    assert.equal(classifySignupError({ kind: "existing_account" }), "existing_account");
    assert.equal(classifySignupError({ kind: "password_mismatch" }), "validation");
    assert.equal(
      classifySignupError({ message: "User already registered" }),
      "existing_account"
    );
    assert.equal(classifySignupError({ message: "Password too weak" }), "password");
    assert.equal(classifySignupError({ message: "Too many requests" }), "rate_limit");
    assert.equal(classifySignupError({ message: "Network fetch failed" }), "server_error");
    assert.equal(classifySignupError({ message: "Invalid login" }), "auth_error");
    assert.equal(classifySignupError({}), "unknown");
  });

  it("buildAcquisitionContext never includes partner PII", () => {
    const ctx = buildAcquisitionContext({
      firstTouch: {
        utm_source: "instagram",
        utm_medium: "paid_social",
        utm_campaign: "contractor_q2",
        landing_page: "/",
      },
      partnerReferralPresent: true,
    });
    assert.equal(ctx.partner_referral_present, true);
    assert.equal(ctx.referral_present, true);
    assert.equal(ctx.entry_source, "partner_referral");
    assert.equal(ctx.utm_source, "instagram");
    assert.equal(
      Object.keys(ctx).some((k) => /email|code|name|phone|user/i.test(k) && k !== "utm_source"),
      false
    );
    const serialized = JSON.stringify(ctx);
    assert.doesNotMatch(serialized, /@/);
    assert.doesNotMatch(serialized, /JP-/);
  });
});

describe("signup funnel analytics wiring", () => {
  it("keeps signup_submit distinct from sign_up in helper module", async () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/signup-funnel-analytics.ts"),
      "utf8"
    );
    assert.match(source, /signup_submit/);
    assert.match(source, /sign_up/);
    assert.match(source, /CompleteRegistration/);
    assert.match(source, /error_category/);
    assert.doesNotMatch(source, /email\s*:/);
  });

  it("fires sign_up only after successful account creation paths", () => {
    const signupPage = readFileSync(
      join(process.cwd(), "src/app/(auth)/signup/page.tsx"),
      "utf8"
    );
    assert.match(signupPage, /trackSignupSuccess\(\{\s*requiresEmailVerification:\s*false/);
    assert.match(signupPage, /trackSignupSuccess\(\{\s*requiresEmailVerification:\s*true/);
    assert.match(signupPage, /trackSignupError\(\{\s*kind:\s*"existing_account"/);
    // existing-account branches must not call trackSignupSuccess
    const existingBlocks = signupPage.split("existing_account");
    assert.ok(existingBlocks.length >= 2);
    assert.doesNotMatch(
      signupPage.match(
        /if \(isEmailAlreadyRegisteredError[\s\S]*?return;\s*\n\s*\}/
      )?.[0] ?? "",
      /trackSignupSuccess/
    );
  });

  it("onboarding_complete only lives on onboarding business form, not settings", () => {
    const onboardingForm = readFileSync(
      join(process.cwd(), "src/app/(app)/onboarding/business-profile/onboarding-business-form.tsx"),
      "utf8"
    );
    const settingsForm = readFileSync(
      join(process.cwd(), "src/app/(app)/settings/business/business-settings-form.tsx"),
      "utf8"
    );
    assert.match(onboardingForm, /onboarding_complete/);
    assert.doesNotMatch(settingsForm, /onboarding_complete|trackGa4Event/);
  });

  it("onboarding_start mounts on both onboarding steps; onboarding_complete only after a successful save", () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    assert.match(
      read("src/app/(app)/onboarding/plan/page.tsx"),
      /<OnboardingStartTracker step="plan" \/>/
    );
    assert.match(
      read("src/app/(app)/onboarding/business-profile/page.tsx"),
      /<OnboardingStartTracker step="business_profile" \/>/
    );
    const trackers = read("src/components/contractor-onboarding-analytics.tsx");
    assert.match(
      trackers,
      /trackGa4EventOnce\(\s*"onboarding_start",\s*GA4_FUNNEL_EVENTS\.onboarding_start/
    );

    const form = read("src/app/(app)/onboarding/business-profile/onboarding-business-form.tsx");
    const save = form.indexOf("await completeOnboardingBusinessSetup(formData)");
    const errorReturn = form.indexOf("if (!result.success) {", save);
    const fire = form.indexOf('"onboarding_complete"', save);
    const navigate = form.indexOf("router.push(result.redirectTo)", save);
    assert.ok(save > 0 && errorReturn > save && fire > errorReturn && navigate > fire);
    assert.equal(form.match(/"onboarding_complete"/g)?.length, 1);
  });

  it("onboarding_plan_selected fires only after the plan is saved, with the tier only", () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    const form = read("src/app/(app)/onboarding/plan/plan-selection-form.tsx");
    const save = form.indexOf("await selectOnboardingPlan(planTier)");
    const errorReturn = form.indexOf("if (!result.success) {", save);
    const fire = form.indexOf("GA4_FUNNEL_EVENTS.onboarding_plan_selected", save);
    const navigate = form.indexOf("router.push(result.redirectTo)", save);
    assert.ok(save > 0 && errorReturn > save && fire > errorReturn && navigate > fire);
    assert.match(form, /onboarding_plan_selected, \{ plan_tier: planTier \}\)/);
  });

  it("does not install a second GA measurement ID", () => {
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    // The tag is installed only through the hostname-gated bootstrap.
    assert.doesNotMatch(layout, /G-[A-Z0-9]{4,}/);
    assert.doesNotMatch(layout, /googletagmanager/);
    assert.equal(layout.match(/<Script id="google-analytics"/g)?.length, 1);
    assert.match(layout, /const ga4BootstrapScript = buildGa4BootstrapScript\(\);/);
    const env = readFileSync(join(process.cwd(), "src/lib/ga4-environment.ts"), "utf8");
    assert.equal(env.match(/G-[A-Z0-9]{4,}/g)?.length, 1);
    const funnelTrackers = readFileSync(
      join(process.cwd(), "src/components/contractor-funnel-trackers.tsx"),
      "utf8"
    );
    assert.doesNotMatch(funnelTrackers, /G-[A-Z0-9]+/);
    assert.doesNotMatch(funnelTrackers, /googletagmanager/);
  });

  it("exports the full contractor funnel event set", () => {
    assert.deepEqual(
      Object.values(GA4_FUNNEL_EVENTS).sort(),
      [
        "contractor_cta_click",
        "contractor_landing_view",
        "contractor_section_cta_click",
        "email_verification_required",
        "onboarding_complete",
        "onboarding_plan_selected",
        "onboarding_start",
        "sample_quote_cta_click",
        "sample_quote_view",
        "sign_up",
        "signup_error",
        "signup_start",
        "signup_submit",
        "signup_verified",
        "signup_view",
        "trial_started",
      ].sort()
    );
    assert.equal("contractor_activated" in GA4_FUNNEL_EVENTS, false);
  });
});

describe("signup funnel success helpers", () => {
  let gtagCalls: GtagCall[] = [];
  let metaCalls: unknown[][] = [];

  beforeEach(() => {
    const mocks = installBrowserMocks();
    gtagCalls = mocks.gtagCalls;
    metaCalls = [];
    clearGa4OnceFiredForTests();
    (globalThis as { window: { fbq?: (...args: unknown[]) => void; gtag?: unknown; sessionStorage: Storage } }).window.fbq =
      (...args: unknown[]) => {
        metaCalls.push(args);
      };
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { document?: unknown }).document;
  });

  it("signup_submit is distinct from sign_up; existing account never signs up", async () => {
    const {
      trackSignupSubmit,
      trackSignupSuccess,
      trackSignupError,
      trackSignupView,
      trackSignupStart,
    } = await import("@/lib/signup-funnel-analytics");

    trackSignupView();
    trackSignupView();
    trackSignupStart();
    trackSignupStart();
    trackSignupSubmit();
    trackSignupSubmit();

    const category = trackSignupError({ kind: "existing_account" });
    assert.equal(category, "existing_account");

    const eventNames = gtagCalls.map((c) => c[1]);
    assert.deepEqual(
      eventNames.filter((n) => n === "signup_view"),
      ["signup_view"]
    );
    assert.deepEqual(
      eventNames.filter((n) => n === "signup_start"),
      ["signup_start"]
    );
    assert.equal(eventNames.filter((n) => n === "signup_submit").length, 2);
    assert.equal(eventNames.includes("sign_up"), false);

    const errParams = gtagCalls.find((c) => c[1] === "signup_error")?.[2] as Record<
      string,
      unknown
    >;
    assert.equal(errParams.error_category, "existing_account");
    assert.equal(errParams.email, undefined);
    assert.equal(errParams.message, undefined);

    trackSignupSuccess({ requiresEmailVerification: true });
    assert.ok(gtagCalls.some((c) => c[1] === "sign_up"));
    assert.ok(gtagCalls.some((c) => c[1] === "email_verification_required"));
    assert.equal(gtagCalls.some((c) => c[1] === "signup_verified"), false);
    assert.ok(
      metaCalls.some(
        (c) => c[0] === "track" && c[1] === "CompleteRegistration"
      )
    );

    const signUpParams = gtagCalls.find((c) => c[1] === "sign_up")?.[2] as Record<
      string,
      unknown
    >;
    assert.equal(signUpParams.method, "email");
    assert.equal(signUpParams.email, undefined);
    assert.equal(signUpParams.user_id, undefined);
  });

  it("instant session path marks signup_verified without email_verification_required", async () => {
    const { trackSignupSuccess } = await import("@/lib/signup-funnel-analytics");
    trackSignupSuccess({ requiresEmailVerification: false });
    const names = gtagCalls.map((c) => c[1]);
    assert.ok(names.includes("sign_up"));
    assert.equal(names.includes("email_verification_required"), false);
    // Sent by the app shell after the server claim, not directly from the signup page.
    assert.equal(names.includes("signup_verified"), false);
    assert.match(
      (globalThis as unknown as { document: { cookie: string } }).document.cookie,
      /jp_ga4_sv_pending=instant/
    );
  });
});
