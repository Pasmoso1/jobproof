import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decideSignupVerifiedAnalyticsMarker,
  GA4_EMAIL_VERIFY_PENDING_COOKIE,
  GA4_SIGNUP_VERIFIED_PENDING_COOKIE,
} from "@/lib/ga4-signup-verified-marker";
import { clearGa4OnceFiredForTests, trackGa4EventOnce } from "@/lib/ga4";

describe("decideSignupVerifiedAnalyticsMarker", () => {
  it("A: new-account signup OTP confirmation schedules signup_verified", () => {
    const d = decideSignupVerifiedAnalyticsMarker({
      authSucceeded: true,
      type: "signup",
      nextPath: "/dashboard",
      emailVerifyPendingCookie: false,
    });
    assert.equal(d.markSignupVerifiedPending, true);
    assert.equal(d.clearEmailVerifyPending, true);
  });

  it("A2: type=email confirmation also schedules signup_verified", () => {
    const d = decideSignupVerifiedAnalyticsMarker({
      authSucceeded: true,
      type: "email",
      nextPath: "/login",
      emailVerifyPendingCookie: false,
    });
    assert.equal(d.markSignupVerifiedPending, true);
  });

  it("A3: PKCE without type uses email-verify pending cookie", () => {
    const d = decideSignupVerifiedAnalyticsMarker({
      authSucceeded: true,
      type: null,
      nextPath: "/login",
      emailVerifyPendingCookie: true,
    });
    assert.equal(d.markSignupVerifiedPending, true);
    assert.equal(d.clearEmailVerifyPending, true);
  });

  it("D: ordinary login / session without pending marker does not schedule", () => {
    const d = decideSignupVerifiedAnalyticsMarker({
      authSucceeded: true,
      type: null,
      nextPath: "/dashboard",
      emailVerifyPendingCookie: false,
    });
    assert.equal(d.markSignupVerifiedPending, false);
    assert.equal(d.clearEmailVerifyPending, false);
  });

  it("E: password-reset / recovery never schedules signup_verified", () => {
    assert.equal(
      decideSignupVerifiedAnalyticsMarker({
        authSucceeded: true,
        type: "recovery",
        nextPath: "/update-password",
        emailVerifyPendingCookie: true,
      }).markSignupVerifiedPending,
      false
    );
    assert.equal(
      decideSignupVerifiedAnalyticsMarker({
        authSucceeded: true,
        type: null,
        nextPath: "/update-password",
        emailVerifyPendingCookie: true,
      }).markSignupVerifiedPending,
      false
    );
  });

  it("F: failed auth does not schedule signup_verified", () => {
    const d = decideSignupVerifiedAnalyticsMarker({
      authSucceeded: false,
      type: "signup",
      nextPath: "/dashboard",
      emailVerifyPendingCookie: true,
    });
    assert.equal(d.markSignupVerifiedPending, false);
  });
});

describe("signup_verified consume + dedupe", () => {
  const store = new Map<string, string>();
  let cookies = "";
  let gtagCalls: unknown[][] = [];

  beforeEach(() => {
    store.clear();
    cookies = "";
    gtagCalls = [];
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
      gtag: (...args: unknown[]) => gtagCalls.push(args),
      sessionStorage: storage,
      localStorage: storage,
      location: { search: "", pathname: "/onboarding/plan" },
    };
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        get cookie() {
          return cookies;
        },
        set cookie(value: string) {
          const [pair] = value.split(";");
          const eq = pair.indexOf("=");
          const name = pair.slice(0, eq).trim();
          const raw = pair.slice(eq + 1).trim();
          const maxAgeMatch = value.match(/max-age=(\d+)/i);
          const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : 1;
          const parts = cookies
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean)
            .filter((p) => !p.startsWith(`${name}=`));
          if (maxAge > 0 && raw !== "") {
            parts.push(`${name}=${raw}`);
          }
          cookies = parts.join("; ");
        },
      },
    });
    clearGa4OnceFiredForTests();
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { document?: unknown }).document;
  });

  it("A+B: confirmation journey fires signup_verified once", async () => {
    const {
      trackSignupSuccess,
      consumeSignupVerifiedPendingAndTrack,
    } = await import("@/lib/signup-funnel-analytics");

    trackSignupSuccess({ requiresEmailVerification: true });
    assert.ok(gtagCalls.some((c) => c[1] === "sign_up"));
    assert.ok(gtagCalls.some((c) => c[1] === "email_verification_required"));
    assert.equal(gtagCalls.some((c) => c[1] === "signup_verified"), false);
    assert.match(cookies, new RegExp(`${GA4_EMAIL_VERIFY_PENDING_COOKIE}=1`));

    // Auth callback would set sv_pending (simulated).
    cookies = `${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`;

    assert.equal(consumeSignupVerifiedPendingAndTrack(), true);
    assert.equal(consumeSignupVerifiedPendingAndTrack(), false);
    assert.equal(
      gtagCalls.filter((c) => c[1] === "signup_verified").length,
      1
    );
    const params = gtagCalls.find((c) => c[1] === "signup_verified")?.[2] as Record<
      string,
      unknown
    >;
    assert.equal(params.email, undefined);
    assert.equal(params.user_id, undefined);
    assert.equal(params.method, "email");
    assert.doesNotMatch(JSON.stringify(params), /@/);
  });

  it("C: refresh after verification does not fire again (session once-key)", async () => {
    const { consumeSignupVerifiedPendingAndTrack } = await import(
      "@/lib/signup-funnel-analytics"
    );
    cookies = `${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`;
    assert.equal(consumeSignupVerifiedPendingAndTrack(), true);
    // Simulate refresh re-setting a stale cookie somehow — once-key still blocks.
    cookies = `${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`;
    assert.equal(consumeSignupVerifiedPendingAndTrack(), false);
    assert.equal(
      gtagCalls.filter((c) => c[1] === "signup_verified").length,
      1
    );
  });

  it("D: ordinary login path without pending cookie does not fire", async () => {
    const { consumeSignupVerifiedPendingAndTrack } = await import(
      "@/lib/signup-funnel-analytics"
    );
    cookies = "";
    assert.equal(consumeSignupVerifiedPendingAndTrack(), false);
    assert.equal(gtagCalls.length, 0);
  });

  it("G: onboarding_start remains independent of signup_verified", () => {
    trackGa4EventOnce("onboarding_start", "onboarding_start", {
      onboarding_step: "plan",
    });
    trackGa4EventOnce("onboarding_start", "onboarding_start", {
      onboarding_step: "plan",
    });
    assert.equal(
      gtagCalls.filter((c) => c[1] === "onboarding_start").length,
      1
    );
    assert.equal(gtagCalls.some((c) => c[1] === "signup_verified"), false);
  });

  it("I+J: sign_up and email_verification_required definitions unchanged", async () => {
    const { trackSignupSuccess } = await import("@/lib/signup-funnel-analytics");
    trackSignupSuccess({ requiresEmailVerification: true });
    const names = gtagCalls.map((c) => c[1]);
    assert.deepEqual(
      names.filter((n) => n === "sign_up" || n === "email_verification_required"),
      ["sign_up", "email_verification_required"]
    );
    assert.equal(names.includes("signup_verified"), false);
  });
});

describe("auth callback wiring for signup_verified marker", () => {
  it("callback applies analytics cookies without changing recovery redirects", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/auth/callback/route.ts"),
      "utf8"
    );
    assert.match(source, /applySignupVerifiedAnalyticsCookies/);
    assert.match(source, /decideSignupVerifiedAnalyticsMarker|GA4_SIGNUP_VERIFIED_PENDING_COOKIE/);
    assert.match(source, /type === "recovery"/);
    assert.match(source, /\/update-password/);
    // Auth destinations unchanged
    assert.match(source, /\/dashboard\?confirmed=true/);
    assert.match(source, /emailRedirectTo|nextPath === "\/update-password"/);
  });

  it("app shell mounts SignupVerifiedPendingBridge", () => {
    const layout = readFileSync(
      join(process.cwd(), "src/app/(app)/layout.tsx"),
      "utf8"
    );
    assert.match(layout, /SignupVerifiedPendingBridge/);
  });

  it("middleware preserves confirmed through plan redirect", () => {
    const mw = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");
    assert.match(mw, /BETA_PLAN_ONBOARDING_PATH/);
    assert.match(mw, /confirmed/);
  });

  it("marker module cookie values are non-PII booleans only", () => {
    assert.equal(GA4_EMAIL_VERIFY_PENDING_COOKIE, "jp_ga4_ev_pending");
    assert.equal(GA4_SIGNUP_VERIFIED_PENDING_COOKIE, "jp_ga4_sv_pending");
    const source = readFileSync(
      join(process.cwd(), "src/lib/ga4-signup-verified-marker.ts"),
      "utf8"
    );
    // Cookie assignments always use the literal "1", never emails/ids/tokens.
    assert.match(source, /GA4_EMAIL_VERIFY_PENDING_COOKIE,\s*\n\s*"1"/);
    assert.doesNotMatch(source, /cookies\.set\([^)]*email/i);
    assert.doesNotMatch(source, /@/);
  });
});
