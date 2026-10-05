import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import SignupPage from "@/app/(auth)/signup/page";
import { CONTRACTOR_CONVERSION_FUNNEL, clearGa4OnceFiredForTests } from "@/lib/ga4";
import {
  trackSignupStart,
  trackSignupSuccess,
  trackSignupView,
} from "@/lib/signup-funnel-analytics";
import {
  captureFirstTouchIfMissing,
  persistHeardAboutSourceClient,
  readFirstTouchClient,
} from "@/lib/attribution-first-touch";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const SIGNUP_PATH = "src/app/(auth)/signup/page.tsx";
const signupSource = read(SIGNUP_PATH);

const noopRouter = {
  push() {},
  replace() {},
  refresh() {},
  back() {},
  forward() {},
  prefetch() {},
};

const signupHtml = renderToStaticMarkup(
  createElement(
    AppRouterContext.Provider,
    { value: noopRouter as never },
    createElement(SignupPage)
  )
);

const formHtml = /<form\b[\s\S]*?<\/form>/.exec(signupHtml)?.[0] ?? "";

function installBrowserMocks(opts: { cookie?: string; search?: string } = {}) {
  const store = new Map<string, string>();
  const gtagCalls: unknown[][] = [];
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
    location: { search: opts.search ?? "", pathname: "/signup" },
  };
  (globalThis as { document?: { cookie: string; referrer: string } }).document = {
    cookie: opts.cookie ?? "",
    referrer: "",
  };
  return { gtagCalls, metaCalls };
}

function removeBrowserMocks() {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { document?: unknown }).document;
}

function functionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `missing ${signature}`);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${signature}`);
}

describe("signup page positioning", () => {
  it("continues the free-trial CTA with the new heading and copy", () => {
    assert.match(signupHtml, /<h1[^>]*>Start your 14-day free trial<\/h1>/);
    assert.match(
      signupHtml,
      /Create your JobProof account and start turning more inquiries into paying jobs\./
    );
    assert.doesNotMatch(signupHtml, />Create account</);
    assert.doesNotMatch(signupHtml, /Sign up to start protecting your jobs/);
  });

  it("shows the three trial reassurances in a compact, wrapping row above the form", () => {
    const list = /<ul aria-label="Free trial details" class="([^"]*)">([\s\S]*?)<\/ul>/.exec(
      signupHtml
    );
    assert.ok(list);
    assert.ok(list[1].split(/\s+/).includes("flex-wrap"));
    const items = [...list[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, "").trim()
    );
    assert.deepEqual(items, [
      "14 days free",
      "No credit card required",
      "Cancel anytime during your trial",
    ]);
    assert.ok(signupHtml.indexOf("Free trial details") < signupHtml.indexOf("<form"));
  });

  it("labels the submit button Start My Free Trial without changing its behaviour", () => {
    const submit = /<button type="submit"[^>]*>([\s\S]*?)<\/button>/.exec(formHtml);
    assert.ok(submit);
    assert.equal(submit[1].trim(), "Start My Free Trial");
    assert.match(submit[0], /bg-\[#2436BB\]/);
    assert.match(signupSource, /<form onSubmit=\{handleSubmit\}/);
    assert.match(signupSource, /loading \? "Creating account\.\.\." : "Start My Free Trial"/);
  });

  it("keeps the sign-in link for existing users", () => {
    assert.match(signupHtml, /Already have an account\?/);
    assert.match(signupHtml, /href="\/login"/);
  });
});

describe("initial signup form", () => {
  it("contains only email, password and confirm password", () => {
    const inputs = [...formHtml.matchAll(/<input\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(inputs, ["email", "password", "confirmPassword"]);
    assert.doesNotMatch(formHtml, /<select\b/);
    assert.doesNotMatch(signupHtml, /How did you hear about JobProof/);
    assert.doesNotMatch(signupSource, /heardAboutSource|HEARD_ABOUT_SOURCE_OPTIONS/);
  });

  it("keeps appropriate input types, autocomplete and password rules", () => {
    assert.match(formHtml, /<input id="email" type="email" required=""[^>]*autoComplete="email"/);
    assert.match(
      formHtml,
      /<input id="password" type="password" required="" minLength="6"[^>]*autoComplete="new-password"/
    );
    assert.match(
      formHtml,
      /<input id="confirmPassword" type="password" required=""[^>]*autoComplete="new-password"/
    );
    assert.match(formHtml, /At least 6 characters/);
  });

  it("keeps a show/hide password control on both password fields", () => {
    const toggles = formHtml.match(/<button type="button"[^>]*aria-label="Show password"/g) ?? [];
    assert.equal(toggles.length, 2);
    assert.match(signupSource, /onClick=\{\(\) => setShowPassword\(!showPassword\)\}/);
    assert.match(signupSource, /type=\{showPassword \? "text" : "password"\}/);
  });

  it("blocks submission on mismatched passwords before calling Supabase", () => {
    const submit = functionBody(signupSource, "async function handleSubmit");
    const mismatch = submit.search(
      /if \(password !== confirmPassword\) \{\s*setPasswordMismatch\(true\);\s*trackSignupError\(\{ kind: "password_mismatch" \}\);\s*return;\s*\}/
    );
    assert.ok(mismatch > 0);
    assert.ok(mismatch < submit.indexOf("supabase.auth.signUp("));
    assert.match(signupSource, /role="alert"[^>]*>\s*Passwords do not match\./);
  });

  it("keeps the same Supabase sign-up, confirmation redirect and existing-user handling", () => {
    const submit = functionBody(signupSource, "async function handleSubmit");
    assert.match(
      submit,
      /supabase\.auth\.signUp\(\{\s*email,\s*password,\s*options: \{\s*emailRedirectTo: `\$\{window\.location\.origin\}\/auth\/callback\?next=\/login`/
    );
    assert.match(submit, /isEmailAlreadyRegisteredError\(signUpError\.message\)/);
    assert.match(submit, /duplicateByIdentities/);
    assert.match(submit, /setPostSubmitView\("new_user_check_email"\)/);
    assert.match(signupSource, /supabase\.auth\.resend\(\{\s*type: "signup"/);
    assert.match(signupSource, /href="\/forgot-password"/);
  });
});

describe("signup attribution is unaffected", () => {
  afterEach(removeBrowserMocks);

  it("still captures first-touch UTMs and applies partner attribution", () => {
    const submit = functionBody(signupSource, "async function handleSubmit");
    assert.ok(
      submit.indexOf("captureFirstTouchIfMissing(") < submit.indexOf("supabase.auth.signUp(")
    );
    assert.match(submit, /await applyPartnerReferralAttributionFromSession\(\)/);
    assert.match(signupSource, /readPartnerRefClient\(\)/);
    assert.match(signupSource, /new URLSearchParams\(window\.location\.search\)\.get\("ref"\)/);
  });

  it("first-touch capture keeps UTMs without the heard-about answer", () => {
    installBrowserMocks({ search: "?utm_source=facebook&utm_medium=paid_ad&utm_campaign=trial" });
    const captured = captureFirstTouchIfMissing("/signup?utm_source=facebook");
    assert.equal(captured.utm_source, "facebook");
    assert.equal(captured.utm_medium, "paid_ad");
    assert.equal(captured.utm_campaign, "trial");
    assert.equal(captured.heard_about_source, null);
    assert.equal(readFirstTouchClient()?.utm_source, "facebook");
  });

  it("leaves the heard-about plumbing in place for existing data", () => {
    installBrowserMocks();
    persistHeardAboutSourceClient("google_search");
    assert.equal(readFirstTouchClient()?.heard_about_source, "google_search");
    assert.match(
      read("src/app/auth/callback/route.ts"),
      /if \(!profile\?\.heard_about_source && attribution\.heard_about_source\)/
    );
  });
});

describe("signup funnel analytics", () => {
  let gtagCalls: unknown[][] = [];
  let metaCalls: unknown[][] = [];

  beforeEach(() => {
    const mocks = installBrowserMocks();
    gtagCalls = mocks.gtagCalls;
    metaCalls = mocks.metaCalls;
    clearGa4OnceFiredForTests();
  });

  afterEach(removeBrowserMocks);

  it("reuses signup_view as the signup page view stage instead of adding a duplicate", () => {
    const stages = CONTRACTOR_CONVERSION_FUNNEL.map((s) => s.stage);
    const view = CONTRACTOR_CONVERSION_FUNNEL.find((s) => s.stage === "signup_page_view");
    assert.equal(view?.event, "signup_view");
    assert.ok(stages.indexOf("trial_cta_click") < stages.indexOf("signup_page_view"));
    assert.ok(stages.indexOf("signup_page_view") < stages.indexOf("signup_started"));
    assert.doesNotMatch(signupSource, /signup_page_view/);
  });

  it("signup_view fires once on page view, even if effects run twice", () => {
    trackSignupView();
    trackSignupView();
    assert.deepEqual(gtagCalls.map((c) => c[1]), ["signup_view"]);
    assert.equal(metaCalls.length, 0);
  });

  it("page load only tracks signup_view; signup_start waits for form input", () => {
    const effects = [...signupSource.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[\]\);/g)]
      .map((m) => m[1])
      .join("\n");
    assert.match(effects, /trackSignupView\(\)/);
    assert.doesNotMatch(effects, /trackSignupStart|markSignupStarted/);

    const starts = [...signupSource.matchAll(/onChange=\{\(e\) => \{\s*markSignupStarted\(\);/g)];
    assert.equal(starts.length, 3);
    assert.equal((signupSource.match(/markSignupStarted\(\);/g) ?? []).length, 3);
    assert.equal((signupSource.match(/trackSignupStart\(\)/g) ?? []).length, 1);
  });

  it("signup_start fires once per session and is not a sign_up", () => {
    trackSignupStart();
    trackSignupStart();
    assert.deepEqual(gtagCalls.map((c) => c[1]), ["signup_start"]);
    assert.equal(metaCalls.length, 0);
  });

  it("sign_up and CompleteRegistration only come from successful account creation", () => {
    trackSignupSuccess({ requiresEmailVerification: true });
    const names = gtagCalls.map((c) => c[1]);
    assert.ok(names.includes("sign_up"));
    assert.ok(!names.includes("trial_started"));
    assert.deepEqual(
      metaCalls.filter((c) => c[0] === "track").map((c) => c[1]),
      ["CompleteRegistration"]
    );

    const submit = functionBody(signupSource, "async function handleSubmit");
    const successCalls = submit.match(/trackSignupSuccess\(/g) ?? [];
    assert.equal(successCalls.length, 2);
    assert.ok(submit.indexOf("trackSignupSuccess(") > submit.indexOf("supabase.auth.signUp("));
  });

  it("the signup button never starts the trial or fires trial_started", () => {
    assert.doesNotMatch(
      signupSource,
      /trial_started|StartTrial|maybeStartManagedTrial|markTrialStartedAnalyticsPending|start-managed-trial|ga4-trial-started/
    );
  });
});
