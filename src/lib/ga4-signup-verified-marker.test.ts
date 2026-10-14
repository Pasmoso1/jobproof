import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decideSignupVerifiedAnalyticsMarker,
  GA4_EMAIL_VERIFY_PENDING_COOKIE,
  GA4_SIGNUP_VERIFIED_PENDING_COOKIE,
  NON_SIGNUP_CONFIRM_OTP_TYPES,
  SIGNUP_CONFIRM_OTP_TYPES,
  isRecentEmailConfirmation,
  type SignupVerifiedClaimResult,
} from "@/lib/ga4-signup-verified-marker";
import {
  claimSignupVerifiedAnalytics,
  isSignupVerifiedAnalyticsPending,
} from "@/lib/ga4-signup-verified-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clearGa4OnceFiredForTests, trackGa4EventOnce } from "@/lib/ga4";

describe("decideSignupVerifiedAnalyticsMarker", () => {
  it("authoritative type=signup schedules signup_verified without Device A cookie", () => {
    const d = decideSignupVerifiedAnalyticsMarker({
      authSucceeded: true,
      type: "signup",
      nextPath: "/dashboard",
      emailVerifyPendingCookie: false,
    });
    assert.equal(d.markSignupVerifiedPending, true);
    assert.equal(d.reason, "explicit_signup_otp");
  });

  it("C: cross-device — type=email (JobProof confirm template) with NO pending cookie", () => {
    const d = decideSignupVerifiedAnalyticsMarker({
      authSucceeded: true,
      type: "email",
      nextPath: "/login",
      emailVerifyPendingCookie: false,
    });
    assert.equal(d.markSignupVerifiedPending, true);
    assert.equal(d.clearEmailVerifyPending, true);
    assert.equal(d.reason, "explicit_signup_otp");
  });

  it("same-browser PKCE fallback uses email-verify pending cookie", () => {
    const d = decideSignupVerifiedAnalyticsMarker({
      authSucceeded: true,
      type: null,
      nextPath: "/login",
      emailVerifyPendingCookie: true,
    });
    assert.equal(d.markSignupVerifiedPending, true);
    assert.equal(d.reason, "email_verify_pending_cookie");
  });

  it("D: ordinary login / session without pending cookie does not schedule", () => {
    const d = decideSignupVerifiedAnalyticsMarker({
      authSucceeded: true,
      type: null,
      nextPath: "/dashboard",
      emailVerifyPendingCookie: false,
    });
    assert.equal(d.markSignupVerifiedPending, false);
    assert.equal(d.reason, "no_signal");
  });

  it("E: password recovery never schedules signup_verified", () => {
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

  it("F: email-change confirmation never schedules signup_verified", () => {
    const d = decideSignupVerifiedAnalyticsMarker({
      authSucceeded: true,
      type: "email_change",
      nextPath: "/dashboard",
      emailVerifyPendingCookie: true,
    });
    assert.equal(d.markSignupVerifiedPending, false);
    assert.equal(d.reason, "non_signup_otp_type");
  });

  it("G: magic-link login never schedules signup_verified", () => {
    const d = decideSignupVerifiedAnalyticsMarker({
      authSucceeded: true,
      type: "magiclink",
      nextPath: "/dashboard",
      emailVerifyPendingCookie: true,
    });
    assert.equal(d.markSignupVerifiedPending, false);
    assert.equal(d.reason, "non_signup_otp_type");
  });

  it("invite OTP never schedules signup_verified", () => {
    const d = decideSignupVerifiedAnalyticsMarker({
      authSucceeded: true,
      type: "invite",
      nextPath: "/dashboard",
      emailVerifyPendingCookie: true,
    });
    assert.equal(d.markSignupVerifiedPending, false);
  });

  it("H: failed auth does not schedule signup_verified", () => {
    const d = decideSignupVerifiedAnalyticsMarker({
      authSucceeded: false,
      type: "email",
      nextPath: "/dashboard",
      emailVerifyPendingCookie: true,
    });
    assert.equal(d.markSignupVerifiedPending, false);
    assert.equal(d.reason, "auth_failed");
  });

  it("OTP type sets cover signup confirm vs denylist", () => {
    assert.ok(SIGNUP_CONFIRM_OTP_TYPES.has("email"));
    assert.ok(SIGNUP_CONFIRM_OTP_TYPES.has("signup"));
    assert.ok(NON_SIGNUP_CONFIRM_OTP_TYPES.has("magiclink"));
    assert.ok(NON_SIGNUP_CONFIRM_OTP_TYPES.has("recovery"));
    assert.ok(NON_SIGNUP_CONFIRM_OTP_TYPES.has("email_change"));
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

  /** Server-side once-per-account guard (profiles.ga4_signup_verified_sent_at). */
  function accountClaim() {
    let recorded = false;
    let calls = 0;
    const claim = async (): Promise<SignupVerifiedClaimResult> => {
      calls += 1;
      if (recorded) return "already_recorded";
      recorded = true;
      return "claimed";
    };
    return { claim, calls: () => calls };
  }

  const verifiedCalls = () => gtagCalls.filter((c) => c[1] === "signup_verified");

  it("A+B: same-browser confirmation journey fires signup_verified once", async () => {
    const { trackSignupSuccess, reconcileSignupVerifiedAnalytics } = await import(
      "@/lib/signup-funnel-analytics"
    );

    trackSignupSuccess({ requiresEmailVerification: true });
    assert.ok(gtagCalls.some((c) => c[1] === "sign_up"));
    assert.ok(gtagCalls.some((c) => c[1] === "email_verification_required"));
    assert.equal(gtagCalls.some((c) => c[1] === "signup_verified"), false);
    assert.match(cookies, new RegExp(`${GA4_EMAIL_VERIFY_PENDING_COOKIE}=1`));

    cookies = `${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`;
    const account = accountClaim();

    assert.equal(await reconcileSignupVerifiedAnalytics({ claim: account.claim }), true);
    assert.equal(await reconcileSignupVerifiedAnalytics({ claim: account.claim }), false);
    assert.equal(verifiedCalls().length, 1);
    assert.equal(cookies.includes(GA4_SIGNUP_VERIFIED_PENDING_COOKIE), false);
    const params = verifiedCalls()[0][2] as Record<string, unknown>;
    assert.equal(params.method, "email");
    assert.equal(params.verification_path, "email_confirm");
  });

  it("signup_verified params never contain email, ids, or referral codes", async () => {
    const { reconcileSignupVerifiedAnalytics } = await import("@/lib/signup-funnel-analytics");
    cookies = `${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1; jp_partner_ref=ACME42`;
    await reconcileSignupVerifiedAnalytics({ claim: accountClaim().claim });
    const params = verifiedCalls()[0][2] as Record<string, unknown>;
    for (const key of ["email", "user_id", "phone", "name", "partner_code", "referral_code"]) {
      assert.equal(params[key], undefined, key);
    }
    assert.doesNotMatch(JSON.stringify(params), /@|ACME42/);
  });

  it("C: cross-device phone consume — only sv_pending, no ev_pending", async () => {
    const { reconcileSignupVerifiedAnalytics } = await import("@/lib/signup-funnel-analytics");
    // Phone never had jp_ga4_ev_pending; callback set jp_ga4_sv_pending from type=email.
    cookies = `${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`;
    assert.equal(await reconcileSignupVerifiedAnalytics({ claim: accountClaim().claim }), true);
    assert.equal(verifiedCalls().length, 1);
  });

  it("I: refresh after verification does not fire again", async () => {
    const { reconcileSignupVerifiedAnalytics } = await import("@/lib/signup-funnel-analytics");
    const account = accountClaim();
    cookies = `${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`;
    assert.equal(await reconcileSignupVerifiedAnalytics({ claim: account.claim }), true);
    cookies = `${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`;
    assert.equal(
      await reconcileSignupVerifiedAnalytics({ claim: account.claim, serverPending: true }),
      false
    );
    assert.equal(verifiedCalls().length, 1);
  });

  it("another device/tab cannot double-count once the account claim is recorded", async () => {
    const { reconcileSignupVerifiedAnalytics } = await import("@/lib/signup-funnel-analytics");
    const account = accountClaim();
    cookies = `${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`;
    assert.equal(await reconcileSignupVerifiedAnalytics({ claim: account.claim }), true);

    // Second browser: fresh session storage, its own marker.
    clearGa4OnceFiredForTests();
    cookies = `${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`;
    assert.equal(await reconcileSignupVerifiedAnalytics({ claim: account.claim }), false);
    assert.equal(verifiedCalls().length, 1);
    assert.equal(cookies.includes(GA4_SIGNUP_VERIFIED_PENDING_COOKIE), false);
  });

  it("concurrent mounts (app shell + confirmed page) fire once", async () => {
    const { reconcileSignupVerifiedAnalytics } = await import("@/lib/signup-funnel-analytics");
    const account = accountClaim();
    cookies = `${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`;
    const results = await Promise.all([
      reconcileSignupVerifiedAnalytics({ claim: account.claim, serverPending: true }),
      reconcileSignupVerifiedAnalytics({ claim: account.claim, confirmedQuery: true }),
    ]);
    assert.deepEqual(results.filter(Boolean), [true]);
    assert.equal(account.calls(), 1);
    assert.equal(verifiedCalls().length, 1);
  });

  it("recent confirmation without any browser marker is reconciled once (server_reconciled)", async () => {
    const { reconcileSignupVerifiedAnalytics } = await import("@/lib/signup-funnel-analytics");
    cookies = "";
    assert.equal(
      await reconcileSignupVerifiedAnalytics({
        claim: accountClaim().claim,
        serverPending: true,
      }),
      true
    );
    const params = verifiedCalls()[0][2] as Record<string, unknown>;
    assert.equal(params.verification_path, "server_reconciled");
  });

  it("instant-session signup is routed through the same claim", async () => {
    const { trackSignupSuccess, reconcileSignupVerifiedAnalytics } = await import(
      "@/lib/signup-funnel-analytics"
    );
    trackSignupSuccess({ requiresEmailVerification: false });
    assert.equal(verifiedCalls().length, 0);
    assert.equal(
      await reconcileSignupVerifiedAnalytics({
        claim: accountClaim().claim,
        serverPending: true,
      }),
      true
    );
    assert.equal(verifiedCalls().length, 1);
    const params = verifiedCalls()[0][2] as Record<string, unknown>;
    assert.equal(params.verification_path, "instant_session");
  });

  it("waits for gtag instead of consuming the marker unsent", async () => {
    const { reconcileSignupVerifiedAnalytics } = await import("@/lib/signup-funnel-analytics");
    const account = accountClaim();
    cookies = `${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`;
    assert.equal(
      await reconcileSignupVerifiedAnalytics({
        claim: account.claim,
        waitForGa4: async () => false,
      }),
      false
    );
    assert.equal(account.calls(), 0);
    assert.match(cookies, new RegExp(`${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`));

    assert.equal(await reconcileSignupVerifiedAnalytics({ claim: account.claim }), true);
    assert.equal(verifiedCalls().length, 1);
  });

  it("transient claim failure keeps the marker for the next visit", async () => {
    const { reconcileSignupVerifiedAnalytics } = await import("@/lib/signup-funnel-analytics");
    cookies = `${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`;
    assert.equal(
      await reconcileSignupVerifiedAnalytics({ claim: async () => "retry" }),
      false
    );
    assert.equal(
      await reconcileSignupVerifiedAnalytics({
        claim: async () => {
          throw new Error("network");
        },
      }),
      false
    );
    assert.match(cookies, new RegExp(`${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`));
    assert.equal(verifiedCalls().length, 0);
  });

  it("server rejecting the claim (not confirmed / too old) never fires", async () => {
    const { reconcileSignupVerifiedAnalytics } = await import("@/lib/signup-funnel-analytics");
    cookies = `${GA4_SIGNUP_VERIFIED_PENDING_COOKIE}=1`;
    assert.equal(
      await reconcileSignupVerifiedAnalytics({
        claim: async () => "not_eligible",
        confirmedQuery: true,
      }),
      false
    );
    assert.equal(verifiedCalls().length, 0);
    assert.equal(cookies.includes(GA4_SIGNUP_VERIFIED_PENDING_COOKIE), false);
  });

  it("D: ordinary login path without pending cookie does not fire", async () => {
    const { reconcileSignupVerifiedAnalytics } = await import("@/lib/signup-funnel-analytics");
    const account = accountClaim();
    cookies = "";
    assert.equal(await reconcileSignupVerifiedAnalytics({ claim: account.claim }), false);
    assert.equal(
      await reconcileSignupVerifiedAnalytics({ claim: account.claim, serverPending: false }),
      false
    );
    assert.equal(account.calls(), 0);
    assert.equal(gtagCalls.length, 0);
  });

  it("H: failed/expired verification leaves no marker and fires nothing", async () => {
    const { reconcileSignupVerifiedAnalytics } = await import("@/lib/signup-funnel-analytics");
    const decision = decideSignupVerifiedAnalyticsMarker({
      authSucceeded: false,
      type: "email",
      nextPath: "/login",
      emailVerifyPendingCookie: true,
    });
    assert.equal(decision.markSignupVerifiedPending, false);
    // Unconfirmed user: server reports nothing pending; the stale ev cookie alone is not a signal.
    cookies = `${GA4_EMAIL_VERIFY_PENDING_COOKIE}=1`;
    const account = accountClaim();
    assert.equal(
      await reconcileSignupVerifiedAnalytics({ claim: account.claim, serverPending: false }),
      false
    );
    assert.equal(account.calls(), 0);
    assert.equal(verifiedCalls().length, 0);
  });

  it("onboarding_start remains independent of signup_verified", () => {
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

  it("J: sign_up and email_verification_required definitions unchanged", async () => {
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

describe("auth callback + confirm-signup template wiring", () => {
  it("callback applies analytics cookies without changing recovery redirects", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/auth/callback/route.ts"),
      "utf8"
    );
    assert.match(source, /applySignupVerifiedAnalyticsCookies/);
    assert.match(source, /GA4_SIGNUP_VERIFIED_PENDING_COOKIE/);
    assert.match(source, /type === "recovery"/);
    assert.match(source, /\/update-password/);
    assert.match(source, /\/dashboard\?confirmed=true/);
  });

  it("confirm-signup email template carries authoritative type=email + token_hash", () => {
    const template = readFileSync(
      join(process.cwd(), "emails/supabase-auth/confirm-signup.html"),
      "utf8"
    );
    assert.match(template, /token_hash=\{\{ \.TokenHash \}\}/);
    assert.match(template, /type=email/);
    assert.doesNotMatch(template, /\{\{ \.ConfirmationURL \}\}/);
  });

  it("magic-link and recovery templates use non-signup types", () => {
    const magic = readFileSync(
      join(process.cwd(), "emails/supabase-auth/magic-link.html"),
      "utf8"
    );
    const reset = readFileSync(
      join(process.cwd(), "emails/supabase-auth/reset-password.html"),
      "utf8"
    );
    assert.match(magic, /type=magiclink/);
    assert.match(reset, /type=recovery/);
  });

  it("app shell mounts SignupVerifiedPendingBridge with the server reconciliation flag", () => {
    const layout = readFileSync(
      join(process.cwd(), "src/app/(app)/layout.tsx"),
      "utf8"
    );
    assert.match(
      layout,
      /<SignupVerifiedPendingBridge serverPending=\{signupVerifiedAnalyticsPending\} \/>/
    );
    assert.match(layout, /isSignupVerifiedAnalyticsPending\(\s*supabase,\s*user\s*\)/);
    const bridges = readFileSync(
      join(process.cwd(), "src/components/contractor-onboarding-analytics.tsx"),
      "utf8"
    );
    assert.equal(
      (bridges.match(/claim: claimSignupVerifiedAnalyticsAction/g) ?? []).length,
      2
    );
    assert.doesNotMatch(bridges, /trackGa4EventOnce\(\s*"signup_verified"/);
  });

  it("migration adds and backfills the once-per-account column", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/070_ga4_signup_verified_sent_at.sql"),
      "utf8"
    );
    assert.match(sql, /ADD COLUMN IF NOT EXISTS ga4_signup_verified_sent_at timestamptz/);
    assert.match(sql, /u\.email_confirmed_at IS NOT NULL/);
    assert.match(sql, /p\.ga4_signup_verified_sent_at IS NULL/);
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
    assert.match(source, /GA4_EMAIL_VERIFY_PENDING_COOKIE,\s*\n\s*"1"/);
    assert.doesNotMatch(source, /cookies\.set\([^)]*email/i);
    assert.doesNotMatch(source, /@/);
  });
});

describe("server-side signup_verified claim", () => {
  const NOW = Date.parse("2026-10-13T12:00:00Z");
  const DAY = 24 * 60 * 60 * 1000;
  const recentUser = {
    id: "user-1",
    email_confirmed_at: new Date(NOW - 5 * 60 * 1000).toISOString(),
  };

  /** Minimal profiles table honouring update(...).eq().is(col, null).select(). */
  function fakeSupabase(opts: {
    sentAt?: string | null;
    error?: { code?: string; message?: string } | null;
  } = {}) {
    const row: Record<string, unknown> = {
      id: "profile-1",
      user_id: "user-1",
      ga4_signup_verified_sent_at: opts.sentAt ?? null,
    };
    const updates: Record<string, unknown>[] = [];
    const client = {
      from(table: string) {
        assert.equal(table, "profiles");
        const filters: Array<[string, unknown]> = [];
        let patch: Record<string, unknown> | null = null;
        const matches = () => filters.every(([col, value]) => row[col] === value);
        const builder = {
          update(values: Record<string, unknown>) {
            patch = values;
            return builder;
          },
          select() {
            if (!patch) return builder;
            if (opts.error) return Promise.resolve({ data: null, error: opts.error });
            if (!matches()) return Promise.resolve({ data: [], error: null });
            updates.push(patch);
            Object.assign(row, patch);
            return Promise.resolve({ data: [{ id: row.id }], error: null });
          },
          eq(col: string, value: unknown) {
            filters.push([col, value]);
            return builder;
          },
          is(col: string, value: unknown) {
            filters.push([col, value]);
            return builder;
          },
          maybeSingle() {
            if (opts.error) return Promise.resolve({ data: null, error: opts.error });
            return Promise.resolve({ data: matches() ? { ...row } : null, error: null });
          },
        };
        return builder;
      },
    };
    return { supabase: client as unknown as SupabaseClient, row, updates };
  }

  it("only confirmations within the reconciliation window qualify", () => {
    assert.equal(isRecentEmailConfirmation(recentUser.email_confirmed_at, NOW), true);
    assert.equal(isRecentEmailConfirmation(new Date(NOW - 8 * DAY).toISOString(), NOW), false);
    assert.equal(isRecentEmailConfirmation(null, NOW), false);
    assert.equal(isRecentEmailConfirmation("not-a-date", NOW), false);
  });

  it("first claim wins; every later claim is already_recorded", async () => {
    const { supabase, updates } = fakeSupabase();
    assert.equal(await claimSignupVerifiedAnalytics(supabase, recentUser, NOW), "claimed");
    assert.equal(
      await claimSignupVerifiedAnalytics(supabase, recentUser, NOW),
      "already_recorded"
    );
    assert.equal(updates.length, 1);
    assert.deepEqual(Object.keys(updates[0]), ["ga4_signup_verified_sent_at"]);
  });

  it("unconfirmed, signed-out, or long-confirmed users are not eligible", async () => {
    const { supabase, updates } = fakeSupabase();
    assert.equal(await claimSignupVerifiedAnalytics(supabase, null, NOW), "not_eligible");
    assert.equal(
      await claimSignupVerifiedAnalytics(supabase, { id: "user-1", email_confirmed_at: null }, NOW),
      "not_eligible"
    );
    assert.equal(
      await claimSignupVerifiedAnalytics(
        supabase,
        { id: "user-1", email_confirmed_at: new Date(NOW - 30 * DAY).toISOString() },
        NOW
      ),
      "not_eligible"
    );
    assert.equal(updates.length, 0);
  });

  it("falls back to session dedupe before migration 070, retries on other errors", async () => {
    const missing = fakeSupabase({
      error: { code: "PGRST204", message: "Could not find the 'ga4_signup_verified_sent_at' column" },
    });
    assert.equal(await claimSignupVerifiedAnalytics(missing.supabase, recentUser, NOW), "claimed");
    const flaky = fakeSupabase({ error: { code: "57014", message: "timeout" } });
    const originalError = console.error;
    console.error = () => {};
    try {
      assert.equal(await claimSignupVerifiedAnalytics(flaky.supabase, recentUser, NOW), "retry");
    } finally {
      console.error = originalError;
    }
  });

  it("layout pending flag: recent + unrecorded only; ordinary later login is not pending", async () => {
    assert.equal(
      await isSignupVerifiedAnalyticsPending(fakeSupabase().supabase, recentUser, NOW),
      true
    );
    assert.equal(
      await isSignupVerifiedAnalyticsPending(
        fakeSupabase({ sentAt: "2026-10-13T11:56:00Z" }).supabase,
        recentUser,
        NOW
      ),
      false
    );
    assert.equal(
      await isSignupVerifiedAnalyticsPending(
        fakeSupabase().supabase,
        { id: "user-1", email_confirmed_at: new Date(NOW - 60 * DAY).toISOString() },
        NOW
      ),
      false
    );
    assert.equal(
      await isSignupVerifiedAnalyticsPending(
        fakeSupabase({ error: { code: "42703", message: "column does not exist" } }).supabase,
        recentUser,
        NOW
      ),
      false
    );
  });
});
