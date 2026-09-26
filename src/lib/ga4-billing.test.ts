import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clearGa4OnceFiredForTests,
  trackGa4Event,
} from "@/lib/ga4";
import {
  GA4_BILLING_EVENTS,
  buildBeginCheckoutParams,
  buildPurchaseParams,
  hasPurchaseOnceFired,
  purchaseOnceDedupeKey,
  trackBeginCheckout,
  trackPurchaseOnce,
} from "@/lib/ga4-billing";
import {
  evaluateGa4PurchaseEligibility,
  normalizeCheckoutSessionSubscriptionId,
  resolveGa4PurchaseValueCad,
} from "@/lib/ga4-purchase-eligibility";
import { isFirstPaidSubscriptionTransition } from "@/lib/trial-conversion";

function installBrowserMocks() {
  const store = new Map<string, string>();
  const gtagCalls: unknown[][] = [];
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
    location: { search: "", pathname: "/settings/billing" },
  };
  (globalThis as { document?: { cookie: string } }).document = { cookie: "" };
  return { gtagCalls };
}

describe("isFirstPaidSubscriptionTransition", () => {
  it("Q: trial → active is first paid", () => {
    assert.equal(isFirstPaidSubscriptionTransition("trial", "active"), true);
    assert.equal(isFirstPaidSubscriptionTransition("expired", "active"), true);
    assert.equal(isFirstPaidSubscriptionTransition("pending_trial", "trialing"), true);
  });

  it("J/K: renewals and already-paid are not first paid", () => {
    assert.equal(isFirstPaidSubscriptionTransition("active", "active"), false);
    assert.equal(isFirstPaidSubscriptionTransition("past_due", "active"), false);
    assert.equal(isFirstPaidSubscriptionTransition("trialing", "active"), false);
  });
});

describe("normalizeCheckoutSessionSubscriptionId", () => {
  it("D: session.subscription as Stripe ID string", () => {
    assert.equal(normalizeCheckoutSessionSubscriptionId("sub_abc123"), "sub_abc123");
    assert.equal(normalizeCheckoutSessionSubscriptionId("  sub_trim  "), "sub_trim");
  });

  it("E: session.subscription as expanded Stripe Subscription object", () => {
    assert.equal(
      normalizeCheckoutSessionSubscriptionId({ id: "sub_expanded", status: "active" }),
      "sub_expanded"
    );
  });

  it("F: missing Checkout subscription → null", () => {
    assert.equal(normalizeCheckoutSessionSubscriptionId(null), null);
    assert.equal(normalizeCheckoutSessionSubscriptionId(undefined), null);
    assert.equal(normalizeCheckoutSessionSubscriptionId(""), null);
    assert.equal(normalizeCheckoutSessionSubscriptionId({}), null);
  });
});

describe("evaluateGa4PurchaseEligibility", () => {
  const matchingSub = "sub_match_1";
  const base = {
    authSucceeded: true,
    checkoutSessionId: "cs_test_abc",
    sessionMode: "subscription",
    paymentStatus: "paid",
    sessionStatus: "complete",
    sessionCustomerMatchesProfile: true,
    sessionProfileMetadataMatches: true,
    sessionCreatedUnix: Math.floor(Date.now() / 1000),
    previousSubscriptionStatus: "trial",
    newSubscriptionStatus: "active",
    checkoutSessionSubscriptionId: matchingSub,
    profileStripeSubscriptionId: matchingSub,
  };

  it("A: Checkout subscription ID matches profile → eligible when other conditions pass", () => {
    const d = evaluateGa4PurchaseEligibility(base);
    assert.equal(d.eligible, true);
    if (d.eligible) assert.equal(d.reason, "first_paid_transition");
  });

  it("B: Checkout subscription ID differs from profile → ineligible", () => {
    const d = evaluateGa4PurchaseEligibility({
      ...base,
      checkoutSessionSubscriptionId: "sub_checkout",
      profileStripeSubscriptionId: "sub_other",
    });
    assert.equal(d.eligible, false);
    if (!d.eligible) assert.equal(d.reason, "subscription_id_mismatch");
  });

  it("C: mismatch remains ineligible even when ≤48h fallback would otherwise pass", () => {
    const d = evaluateGa4PurchaseEligibility({
      ...base,
      previousSubscriptionStatus: "active",
      newSubscriptionStatus: "active",
      checkoutSessionSubscriptionId: "sub_old_checkout",
      profileStripeSubscriptionId: "sub_current_different",
    });
    assert.equal(d.eligible, false);
    if (!d.eligible) assert.equal(d.reason, "subscription_id_mismatch");
  });

  it("F: missing Checkout subscription → ineligible", () => {
    const d = evaluateGa4PurchaseEligibility({
      ...base,
      checkoutSessionSubscriptionId: null,
    });
    assert.equal(d.eligible, false);
    if (!d.eligible) assert.equal(d.reason, "checkout_subscription_missing");
  });

  it("G: missing profile stripe_subscription_id → ineligible", () => {
    const d = evaluateGa4PurchaseEligibility({
      ...base,
      profileStripeSubscriptionId: null,
    });
    assert.equal(d.eligible, false);
    if (!d.eligible) assert.equal(d.reason, "subscription_missing");
  });

  it("H: old Checkout for same customer/profile but different current subscription → ineligible", () => {
    const d = evaluateGa4PurchaseEligibility({
      ...base,
      previousSubscriptionStatus: "active",
      newSubscriptionStatus: "active",
      checkoutSessionSubscriptionId: "sub_from_old_checkout",
      profileStripeSubscriptionId: "sub_replacement",
    });
    assert.equal(d.eligible, false);
    if (!d.eligible) assert.equal(d.reason, "subscription_id_mismatch");
  });

  it("I: matching sub + webhook already active + fresh Checkout → fallback eligible", () => {
    const d = evaluateGa4PurchaseEligibility({
      ...base,
      previousSubscriptionStatus: "active",
      newSubscriptionStatus: "active",
      checkoutSessionSubscriptionId: matchingSub,
      profileStripeSubscriptionId: matchingSub,
    });
    assert.equal(d.eligible, true);
    if (d.eligible) assert.equal(d.reason, "webhook_race_recent_checkout");
  });

  it("M: checkout=success without paid session is not eligible", () => {
    assert.equal(
      evaluateGa4PurchaseEligibility({
        ...base,
        paymentStatus: "unpaid",
        sessionStatus: "open",
      }).eligible,
      false
    );
  });

  it("ordinary paid subscriber (stale session) not eligible", () => {
    assert.equal(
      evaluateGa4PurchaseEligibility({
        ...base,
        previousSubscriptionStatus: "active",
        newSubscriptionStatus: "active",
        sessionCreatedUnix: Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 10,
      }).eligible,
      false
    );
  });

  it("payment mode checkout is not subscription purchase", () => {
    assert.equal(
      evaluateGa4PurchaseEligibility({
        ...base,
        sessionMode: "payment",
      }).eligible,
      false
    );
  });
});

describe("GA4 billing events", () => {
  let gtagCalls: unknown[][] = [];

  beforeEach(() => {
    gtagCalls = installBrowserMocks().gtagCalls;
    clearGa4OnceFiredForTests();
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { document?: unknown }).document;
  });

  it("A: successful begin_checkout params and fire", () => {
    const params = buildBeginCheckoutParams({
      planTier: "essential",
      pricingVersion: "standard",
    });
    assert.equal(params.currency, "CAD");
    assert.equal(params.value, 39);
    assert.equal((params.items as { item_id: string }[])[0].item_id, "essential");
    assert.equal(trackBeginCheckout({ planTier: "essential", pricingVersion: "standard" }), true);
    assert.equal(gtagCalls[0]?.[1], GA4_BILLING_EVENTS.begin_checkout);
  });

  it("P: begin_checkout is not purchase", () => {
    trackBeginCheckout({ planTier: "professional", pricingVersion: "founder" });
    assert.equal(gtagCalls.some((c) => c[1] === "purchase"), false);
    assert.equal(gtagCalls[0]?.[1], "begin_checkout");
  });

  it("B/C: helpers do not invent purchase from page view alone", () => {
    // No automatic fire — only explicit trackBeginCheckout / trackPurchaseOnce.
    assert.equal(gtagCalls.length, 0);
    trackGa4Event("page_view_fake", {});
    assert.equal(gtagCalls.some((c) => c[1] === "begin_checkout"), false);
    assert.equal(gtagCalls.some((c) => c[1] === "purchase"), false);
  });

  it("E/F: purchase includes transaction_id and no PII", () => {
    const params = buildPurchaseParams({
      transactionId: "cs_test_xyz",
      planTier: "professional",
      pricingVersion: "standard",
      valueCad: 59,
    });
    assert.equal(params.transaction_id, "cs_test_xyz");
    assert.equal(params.currency, "CAD");
    assert.equal(params.value, 59);
    const serialized = JSON.stringify(params);
    assert.doesNotMatch(serialized, /@/);
    assert.doesNotMatch(serialized, /email|user_id|cus_/i);
    trackPurchaseOnce({
      transactionId: "cs_test_xyz",
      planTier: "professional",
      pricingVersion: "standard",
      valueCad: 59,
    });
    assert.equal(gtagCalls[0]?.[1], "purchase");
  });

  it("G/H: refresh/remount does not resend purchase", () => {
    assert.equal(
      trackPurchaseOnce({
        transactionId: "cs_once",
        planTier: "essential",
        pricingVersion: "founder",
      }),
      true
    );
    assert.equal(
      trackPurchaseOnce({
        transactionId: "cs_once",
        planTier: "essential",
        pricingVersion: "founder",
      }),
      false
    );
    assert.equal(gtagCalls.filter((c) => c[1] === "purchase").length, 1);
    assert.equal(hasPurchaseOnceFired("cs_once"), true);
    assert.equal(purchaseOnceDedupeKey("cs_once"), "purchase:cs_once");
  });

  it("R: failed verification path never marks once-key", () => {
    const d = evaluateGa4PurchaseEligibility({
      authSucceeded: true,
      checkoutSessionId: "cs_fail",
      sessionMode: "subscription",
      paymentStatus: "unpaid",
      sessionStatus: "open",
      sessionCustomerMatchesProfile: true,
      sessionProfileMetadataMatches: true,
      sessionCreatedUnix: Math.floor(Date.now() / 1000),
      previousSubscriptionStatus: "trial",
      newSubscriptionStatus: "trial",
      checkoutSessionSubscriptionId: null,
      profileStripeSubscriptionId: null,
    });
    assert.equal(d.eligible, false);
    assert.equal(hasPurchaseOnceFired("cs_fail"), false);
  });

  it("J: transaction_id remains the exact Checkout session ID", () => {
    const params = buildPurchaseParams({
      transactionId: "cs_exact_session_id",
      planTier: "essential",
      pricingVersion: "standard",
    });
    assert.equal(params.transaction_id, "cs_exact_session_id");
  });

  it("K: No PII introduced into GA4 purchase payload", () => {
    const params = buildPurchaseParams({
      transactionId: "cs_no_pii",
      planTier: "professional",
      pricingVersion: "founder",
      valueCad: 49,
    });
    const serialized = JSON.stringify(params);
    assert.doesNotMatch(serialized, /@|email|phone|user_id|cus_|profile_id|sub_/i);
    assert.match(serialized, /"transaction_id":"cs_no_pii"/);
  });

  it("value prefers amount_subtotal (pre-tax)", () => {
    assert.equal(
      resolveGa4PurchaseValueCad({
        amountSubtotalCents: 3900,
        amountTotalCents: 4485,
        listPriceCad: 39,
      }),
      39
    );
  });
});

describe("billing GA4 wiring safety", () => {
  it("N: signup funnel event names unchanged in ga4.ts", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/ga4.ts"), "utf8");
    for (const name of [
      "contractor_landing_view",
      "contractor_cta_click",
      "signup_view",
      "signup_start",
      "signup_submit",
      "sign_up",
      "signup_verified",
      "onboarding_start",
      "onboarding_complete",
    ]) {
      assert.match(source, new RegExp(name));
    }
    assert.doesNotMatch(source, /begin_checkout|purchase/);
  });

  it("O: Partner qualification / migration 068 untouched by billing GA4 modules", () => {
    const ga4Billing = readFileSync(join(process.cwd(), "src/lib/ga4-billing.ts"), "utf8");
    const eligibility = readFileSync(
      join(process.cwd(), "src/lib/ga4-purchase-eligibility.ts"),
      "utf8"
    );
    assert.doesNotMatch(ga4Billing, /partner_referral|qualification|068_/);
    assert.doesNotMatch(eligibility, /partner_referral|qualification|068_/);
  });

  it("begin_checkout only after successful checkout URL in client", () => {
    const client = readFileSync(
      join(process.cwd(), "src/app/(app)/settings/billing/billing-actions-client.tsx"),
      "utf8"
    );
    const goCheckout = client.slice(
      client.indexOf("async function goCheckout"),
      client.indexOf("async function goUpgradeProfessional")
    );
    assert.match(goCheckout, /trackBeginCheckout/);
    assert.match(goCheckout, /if \(!result\.success\)/);
    assert.ok(goCheckout.indexOf("trackBeginCheckout") > goCheckout.indexOf("if (!result.success)"));
  });

  it("purchase tracker uses confirmGa4PurchaseAfterCheckout", () => {
    const tracker = readFileSync(
      join(process.cwd(), "src/components/ga4-purchase-after-checkout-tracker.tsx"),
      "utf8"
    );
    assert.match(tracker, /confirmGa4PurchaseAfterCheckout/);
    assert.match(tracker, /trackPurchaseOnce/);
    assert.match(tracker, /result\.eligible/);
  });

  it("confirm action normalizes session.subscription and requires identity match", () => {
    const actions = readFileSync(
      join(process.cwd(), "src/app/(app)/settings/billing/actions.ts"),
      "utf8"
    );
    assert.match(actions, /normalizeCheckoutSessionSubscriptionId\(session\.subscription\)/);
    assert.match(actions, /checkoutSessionSubscriptionId/);
    assert.match(actions, /profileStripeSubscriptionId/);
  });
});
