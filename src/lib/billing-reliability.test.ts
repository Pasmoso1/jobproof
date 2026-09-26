import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildProfileSubscriptionPatch,
  invoiceSubscriptionId,
  linkStripeSubscriptionForProfile,
  selectRecoverableSubscription,
  subscriptionPeriodEndUnix,
  validateCheckoutSessionOwnership,
  type LinkProfileFields,
  type PlanFromPriceId,
  type StripeBillingApi,
} from "@/lib/stripe-subscription-link";
import { shouldAutoSyncStripeSubscriptionOnBillingLoad } from "@/lib/stripe-subscription-profile-sync";
import {
  buildSubscribedSummary,
  resolveCheckoutReturnState,
  shouldShowManagedTrialPanel,
  shouldShowManagedTrialSubscribeCtas,
} from "@/lib/billing-page-state";
import {
  hasLinkedPaidSubscription,
  isJobProofManagedTrialActive,
  isJobProofTrialExpired,
  needsTrialExpiredIntro,
  planTrialReminderActions,
} from "@/lib/trial-lifecycle";
import { getSubscriptionAccess } from "@/lib/subscription-access";
import {
  getBillingPlanName,
  getPlanDisplayLines,
  getPlanGa4ItemName,
  getUpgradeProfessionalButtonLabel,
} from "@/lib/billing-plan-display";
import { betaPlanTierLabel } from "@/lib/beta-tester";
import { evaluateGa4PurchaseEligibility } from "@/lib/ga4-purchase-eligibility";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE_ID = "11111111-2222-3333-4444-555555555555";
const USER_ID = "user-abc";
const CUSTOMER = "cus_TESTCUSTOMER01";
const PERIOD_END = 1_792_000_000; // 2026-10-15T...Z
const DAY_MS = 24 * 60 * 60 * 1000;

const planFromPriceId: PlanFromPriceId = (id) => {
  if (id === "price_solo_standard") return { planTier: "essential", pricingVersion: "standard" };
  if (id === "price_pro_standard") return { planTier: "professional", pricingVersion: "standard" };
  return null;
};

function makeSub(over: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: "sub_NEWPAIDSUB0001",
    object: "subscription",
    customer: CUSTOMER,
    status: "active",
    metadata: { profile_id: PROFILE_ID, plan_tier: "essential", pricing_version: "standard" },
    items: {
      data: [{ id: "si_1", price: { id: "price_solo_standard" }, current_period_end: PERIOD_END }],
    },
    trial_end: null,
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    ...over,
  } as unknown as Stripe.Subscription;
}

function makeSession(over: Record<string, unknown> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_live_SESSION0001",
    object: "checkout.session",
    mode: "subscription",
    status: "complete",
    payment_status: "paid",
    customer: CUSTOMER,
    metadata: { profile_id: PROFILE_ID },
    subscription: "sub_NEWPAIDSUB0001",
    ...over,
  } as unknown as Stripe.Checkout.Session;
}

function trialProfile(over: Partial<LinkProfileFields> & Record<string, unknown> = {}) {
  const started = new Date(Date.now() - 1 * DAY_MS).toISOString();
  const ends = new Date(Date.now() + 13 * DAY_MS).toISOString();
  return {
    id: PROFILE_ID,
    user_id: USER_ID,
    stripe_customer_id: CUSTOMER,
    stripe_subscription_id: null as string | null,
    plan_tier: "essential",
    trial_plan_tier: "essential",
    pricing_version: "standard",
    subscription_status: "trial",
    trial_started_at: started,
    trial_ends_at: ends,
    beta_tester: false,
    ...over,
  };
}

function paidProfile(over: Record<string, unknown> = {}) {
  return trialProfile({
    stripe_subscription_id: "sub_NEWPAIDSUB0001",
    subscription_status: "active",
    subscription_current_period_end: new Date(PERIOD_END * 1000).toISOString(),
    ...over,
  });
}

type MockStripeOptions = {
  session?: Stripe.Checkout.Session | Error;
  subscriptions?: Record<string, Stripe.Subscription>;
  list?: Stripe.Subscription[] | Error;
};

function mockStripe(opts: MockStripeOptions) {
  const calls = { sessionRetrieve: 0, subRetrieve: [] as string[], list: 0 };
  const stripe: StripeBillingApi = {
    checkout: {
      sessions: {
        async retrieve() {
          calls.sessionRetrieve += 1;
          if (!opts.session) throw Object.assign(new Error("No such session"), { type: "StripeInvalidRequestError" });
          if (opts.session instanceof Error) throw opts.session;
          return opts.session;
        },
      },
    },
    subscriptions: {
      async retrieve(id: string) {
        calls.subRetrieve.push(id);
        const sub = opts.subscriptions?.[id];
        if (!sub) throw Object.assign(new Error("No such subscription"), { type: "StripeInvalidRequestError" });
        return sub;
      },
      async list() {
        calls.list += 1;
        if (opts.list instanceof Error) throw opts.list;
        return { data: opts.list ?? [] };
      },
    },
  };
  return { stripe, calls };
}

function mockDb(result: { rows?: number; error?: { message: string } | null } = {}) {
  const calls = { patches: [] as Record<string, unknown>[], eqs: [] as [string, unknown][] };
  const builder = {
    update(patch: Record<string, unknown>) {
      calls.patches.push(patch);
      return builder;
    },
    eq(column: string, value: unknown) {
      calls.eqs.push([column, value]);
      return builder;
    },
    select() {
      const rows = result.rows ?? 1;
      return Promise.resolve({
        data: result.error ? null : Array.from({ length: rows }, () => ({ id: PROFILE_ID })),
        error: result.error ?? null,
      });
    },
  };
  return { db: { from: () => builder } as unknown as SupabaseClient, calls };
}

let logLines: string[] = [];
const originalConsole = { info: console.info, warn: console.warn, error: console.error };

beforeEach(() => {
  logLines = [];
  const capture = (...args: unknown[]) => {
    logLines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  };
  console.info = capture;
  console.warn = capture;
  console.error = capture;
});

afterEach(() => {
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

function link(
  stripe: StripeBillingApi,
  db: SupabaseClient,
  profile = trialProfile(),
  extra: { checkoutSessionId?: string | null; source?: "checkout_return" | "refresh" | "page_load" } = {}
) {
  return linkStripeSubscriptionForProfile({
    stripe,
    db,
    profile,
    userId: USER_ID,
    planFromPriceId,
    source: extra.source ?? "checkout_return",
    checkoutSessionId: extra.checkoutSessionId ?? null,
  });
}

// ---------------------------------------------------------------------------
// Billing page UX
// ---------------------------------------------------------------------------

describe("Billing page checkout-return state", () => {
  it("A: checkout=success alone does NOT show You're subscribed", () => {
    const state = resolveCheckoutReturnState({
      checkoutSuccess: true,
      profile: trialProfile(),
      syncOutcome: null,
    });
    assert.notEqual(state, "subscribed");
    assert.equal(state, "confirming");
  });

  it("B: unlinked return shows confirming while pending, recovery state on hard failure", () => {
    assert.equal(
      resolveCheckoutReturnState({
        checkoutSuccess: true,
        profile: trialProfile(),
        syncOutcome: { ok: false, pending: true },
      }),
      "confirming"
    );
    assert.equal(
      resolveCheckoutReturnState({
        checkoutSuccess: true,
        profile: trialProfile(),
        syncOutcome: { ok: false, pending: false },
      }),
      "sync_failed"
    );
    const page = readFileSync(join(process.cwd(), "src/app/(app)/settings/billing/page.tsx"), "utf8");
    assert.match(page, /Confirming your subscription with Stripe…/);
    assert.match(page, /We couldn&apos;t confirm your subscription yet/);
    assert.match(page, /CheckoutConfirmingRefresh/);
    assert.match(page, /checkoutReturnPending=\{checkoutReturnPending\}/);
  });

  it("C: active linked subscription shows You're subscribed with Solo, Active, next billing date", () => {
    const profile = paidProfile();
    assert.equal(
      resolveCheckoutReturnState({ checkoutSuccess: true, profile, syncOutcome: { ok: true } }),
      "subscribed"
    );
    const summary = buildSubscribedSummary(profile);
    assert.equal(summary.planLine, "Solo — $39 CAD/month + applicable taxes");
    assert.equal(summary.statusLabel, "Active");
    assert.equal(summary.isStripeTrialing, false);
    assert.equal(summary.nextBillingDateIso, new Date(PERIOD_END * 1000).toISOString());
  });

  it("C: missing period end is reported as unavailable, never invented", () => {
    const summary = buildSubscribedSummary(paidProfile({ subscription_current_period_end: null }));
    assert.equal(summary.nextBillingDateIso, null);
  });

  it("D: active paid subscriber does not see the managed-trial countdown or subscribe CTAs", () => {
    const profile = paidProfile();
    assert.equal(isJobProofManagedTrialActive(profile), false);
    assert.equal(
      shouldShowManagedTrialPanel({ profile, checkoutReturnState: "none", isBetaTester: false }),
      false
    );
    assert.equal(
      shouldShowManagedTrialSubscribeCtas({
        profile,
        checkoutReturnState: "none",
        isBetaTester: false,
        hasActiveSubscription: true,
        managedTrialActiveOrStarted: true,
      }),
      false
    );
    // While confirming a Checkout return the trial panel/CTAs are hidden too.
    assert.equal(
      shouldShowManagedTrialPanel({
        profile: trialProfile(),
        checkoutReturnState: "confirming",
        isBetaTester: false,
      }),
      false
    );
    assert.equal(
      shouldShowManagedTrialPanel({
        profile: trialProfile(),
        checkoutReturnState: "none",
        isBetaTester: false,
      }),
      true
    );
  });

  it("E: subscribed panel has no Trial ends / After trial copy for paid subscriptions", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(app)/settings/billing/page.tsx"), "utf8");
    const start = page.indexOf("{subscribedSummary ? (");
    const end = page.indexOf("</ul>", start);
    const panel = page.slice(start, end);
    assert.ok(start > 0);
    assert.doesNotMatch(panel, /After trial/);
    assert.match(panel, /Next billing date/);
    // "Trial ends" is only rendered for a Stripe-side trial.
    assert.match(panel, /isStripeTrialing \?/);
    assert.doesNotMatch(page, /showCheckoutConfirmationDetail|billingComplete/);
    // "Locked until you subscribe" only lives inside the managed-trial panel gate.
    const lockedIdx = page.indexOf("Your trial plan is locked until you");
    const gateIdx = page.lastIndexOf("{showManagedTrialPanel ? (", lockedIdx);
    assert.ok(gateIdx > 0 && gateIdx < lockedIdx);
  });
});

// ---------------------------------------------------------------------------
// Managed trial → early paid subscription
// ---------------------------------------------------------------------------

describe("managed trial → early paid subscription", () => {
  const pastTrialEnd = new Date(Date.now() - 2 * DAY_MS).toISOString();

  it("F: active paid subscriber remains writable after historical trial_ends_at passes", () => {
    const access = getSubscriptionAccess(paidProfile({ trial_ends_at: pastTrialEnd }));
    assert.equal(access.isReadOnlyMode, false);
    assert.equal(access.canCreateJobs, true);
    assert.equal(access.statusLabel, "Active");
  });

  it("G: active paid subscriber is not expired, not redirected to trial-ended, not marked expired", () => {
    const profile = paidProfile({ trial_ends_at: pastTrialEnd });
    assert.equal(isJobProofTrialExpired(profile), false);
    assert.equal(needsTrialExpiredIntro(profile), false);
    assert.equal(planTrialReminderActions(profile).markExpired, false);
  });

  it("H: active paid subscriber receives no trial reminder emails", () => {
    const profile = paidProfile({
      trial_started_at: new Date(Date.now() - 13 * DAY_MS).toISOString(),
    });
    const plan = planTrialReminderActions(profile);
    assert.equal(plan.skipPaid, true);
    assert.equal(plan.sendDay3, false);
    assert.equal(plan.sendDay7, false);
    assert.equal(plan.sendDay12, false);
    // Same profile without the paid link would be due all three.
    const unpaid = planTrialReminderActions(
      trialProfile({ trial_started_at: new Date(Date.now() - 13 * DAY_MS).toISOString() })
    );
    assert.equal(unpaid.sendDay3 && unpaid.sendDay7 && unpaid.sendDay12, true);
  });

  it("I: active paid subscriber receives no trial-ended email", () => {
    const plan = planTrialReminderActions(paidProfile({ trial_ends_at: pastTrialEnd }));
    assert.equal(plan.sendEnded, false);
    const unpaid = planTrialReminderActions(trialProfile({ trial_ends_at: pastTrialEnd }));
    assert.equal(unpaid.sendEnded, true);
  });

  it("I: cron and trial banner defer to the shared paid-subscription rule", () => {
    const cron = readFileSync(join(process.cwd(), "src/lib/trial-reminder-cron.ts"), "utf8");
    assert.match(cron, /planTrialReminderActions\(profile, now\)/);
    assert.match(cron, /if \(actions\.skipPaid\)/);
    const banner = readFileSync(join(process.cwd(), "src/components/trial-status-banner.tsx"), "utf8");
    assert.match(banner, /hasLinkedPaidSubscription\(profile\)\) return null/);
  });

  it("J: early subscription transitions managed trial → active; trial fields kept as history", () => {
    const profile = trialProfile();
    const patch = buildProfileSubscriptionPatch(makeSub(), profile, planFromPriceId);
    assert.equal(patch.subscription_status, "active");
    assert.equal(patch.stripe_subscription_id, "sub_NEWPAIDSUB0001");
    assert.equal(patch.plan_tier, "essential");
    assert.equal(patch.pricing_version, "standard");
    assert.equal(patch.trial_ends_at, profile.trial_ends_at);
    assert.equal(patch.subscription_current_period_end, new Date(PERIOD_END * 1000).toISOString());
    const after = { ...profile, ...patch };
    assert.equal(hasLinkedPaidSubscription(after), true);
    assert.equal(isJobProofManagedTrialActive(after), false);
    assert.equal(getSubscriptionAccess(after).statusLabel, "Active");
  });
});

// ---------------------------------------------------------------------------
// Return sync / recovery
// ---------------------------------------------------------------------------

describe("linkStripeSubscriptionForProfile", () => {
  it("links the Checkout subscription after verifying ownership (server-retrieved)", async () => {
    const { stripe, calls } = mockStripe({
      session: makeSession(),
      subscriptions: { sub_NEWPAIDSUB0001: makeSub() },
    });
    const { db, calls: dbCalls } = mockDb();
    const result = await link(stripe, db, trialProfile(), { checkoutSessionId: "cs_live_SESSION0001" });
    assert.deepEqual(result, {
      ok: true,
      path: "checkout_session",
      subscriptionId: "sub_NEWPAIDSUB0001",
      subscriptionStatus: "active",
    });
    assert.deepEqual(calls.subRetrieve, ["sub_NEWPAIDSUB0001"]);
    assert.equal(calls.list, 0);
    assert.deepEqual(dbCalls.eqs, [
      ["id", PROFILE_ID],
      ["user_id", USER_ID],
    ]);
    assert.equal(dbCalls.patches[0].subscription_status, "active");
  });

  it("K: return sync surfaces database update errors instead of ignoring them", async () => {
    const { stripe } = mockStripe({
      session: makeSession(),
      subscriptions: { sub_NEWPAIDSUB0001: makeSub() },
    });
    const failing = mockDb({ error: { message: "permission denied for table profiles" } });
    const result = await link(stripe, failing.db, trialProfile(), { checkoutSessionId: "cs_live_SESSION0001" });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "database_error");
    assert.ok(logLines.some((l) => l.includes("profile_write_failed")));

    const noRows = mockDb({ rows: 0 });
    const r2 = await link(stripe, noRows.db, trialProfile(), { checkoutSessionId: "cs_live_SESSION0001" });
    assert.equal(r2.ok === false && r2.reason, "profile_not_updated");
  });

  it("L: return sync recovers via stripe_customer_id when the session lookup fails", async () => {
    const { stripe, calls } = mockStripe({
      session: Object.assign(new Error("boom"), { type: "StripeConnectionError" }),
      list: [makeSub()],
    });
    const { db } = mockDb();
    const result = await link(stripe, db, trialProfile(), { checkoutSessionId: "cs_live_SESSION0001" });
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.path, "customer_recovery");
    assert.equal(calls.list, 1);
    assert.ok(logLines.some((l) => l.includes("checkout_session_retrieve_failed")));
  });

  it("L: recovers with no session id and no stored subscription id", async () => {
    const { stripe } = mockStripe({ list: [makeSub()] });
    const { db, calls } = mockDb();
    const result = await link(stripe, db, trialProfile());
    assert.equal(result.ok && result.subscriptionId, "sub_NEWPAIDSUB0001");
    assert.equal(calls.patches[0].stripe_subscription_id, "sub_NEWPAIDSUB0001");
  });

  it("M: customer recovery rejects unrelated subscriptions", () => {
    const ctx = { customerId: CUSTOMER, profileId: PROFILE_ID, planFromPriceId };
    const otherCustomer = makeSub({ id: "sub_OTHERCUST", customer: "cus_SOMEONEELSE" });
    const otherProduct = makeSub({
      id: "sub_OTHERPROD",
      items: { data: [{ id: "si_x", price: { id: "price_not_jobproof" }, current_period_end: PERIOD_END }] },
    });
    const otherProfile = makeSub({ id: "sub_OTHERPROF", metadata: { profile_id: "different-profile" } });
    const canceled = makeSub({ id: "sub_CANCELED", status: "canceled" });
    const selection = selectRecoverableSubscription(
      [otherCustomer, otherProduct, otherProfile, canceled],
      ctx
    );
    assert.deepEqual(selection, { ok: false, reason: "no_subscription_found", candidateCount: 0 });
  });

  it("M: session belonging to another customer/profile is rejected without recovery or writes", async () => {
    for (const session of [
      makeSession({ customer: "cus_SOMEONEELSE" }),
      makeSession({ metadata: { profile_id: "different-profile" } }),
    ]) {
      const { stripe, calls } = mockStripe({ session, list: [makeSub()] });
      const { db, calls: dbCalls } = mockDb();
      const result = await link(stripe, db, trialProfile(), { checkoutSessionId: "cs_live_SESSION0001" });
      assert.equal(result.ok, false);
      assert.equal(calls.list, 0);
      assert.equal(dbCalls.patches.length, 0);
    }
  });

  it("N: customer recovery refuses ambiguous multiple-subscription situations", async () => {
    const { stripe } = mockStripe({
      list: [makeSub({ id: "sub_A" }), makeSub({ id: "sub_B", status: "past_due" })],
    });
    const { db, calls } = mockDb();
    const result = await link(stripe, db, trialProfile(), { source: "refresh" });
    assert.deepEqual(result, { ok: false, reason: "ambiguous_subscriptions", pending: false });
    assert.equal(calls.patches.length, 0);
  });

  it("incomplete Checkout subscription is not linked yet (pending, no write)", async () => {
    const { stripe } = mockStripe({
      session: makeSession(),
      subscriptions: { sub_NEWPAIDSUB0001: makeSub({ status: "incomplete" }) },
    });
    const { db, calls } = mockDb();
    const result = await link(stripe, db, trialProfile(), { checkoutSessionId: "cs_live_SESSION0001" });
    assert.deepEqual(result, { ok: false, reason: "subscription_not_active_yet", pending: true });
    assert.equal(calls.patches.length, 0);
  });

  it("open (not complete) Checkout session stays pending", () => {
    const check = validateCheckoutSessionOwnership(makeSession({ status: "open" }), {
      customerId: CUSTOMER,
      profileId: PROFILE_ID,
    });
    assert.deepEqual(check, { ok: false, reason: "checkout_not_complete" });
  });

  it("expanded session.subscription object is used without trusting a browser-supplied id", () => {
    const check = validateCheckoutSessionOwnership(makeSession({ subscription: makeSub() }), {
      customerId: CUSTOMER,
      profileId: PROFILE_ID,
    });
    assert.equal(check.ok && check.subscriptionId, "sub_NEWPAIDSUB0001");
    assert.ok(check.ok && check.expandedSubscription);
  });

  it("stale canceled link does not hide a newer current subscription", async () => {
    const old = makeSub({ id: "sub_OLDCANCELED", status: "canceled" });
    const { stripe } = mockStripe({
      subscriptions: { sub_OLDCANCELED: old },
      list: [old, makeSub()],
    });
    const { db } = mockDb();
    const result = await link(
      stripe,
      db,
      trialProfile({ stripe_subscription_id: "sub_OLDCANCELED", subscription_status: "canceled" }),
      { source: "refresh" }
    );
    assert.equal(result.ok && result.subscriptionId, "sub_NEWPAIDSUB0001");
  });

  it("logs are non-sensitive (no full Stripe ids, no email)", async () => {
    const { stripe } = mockStripe({ list: [makeSub({ id: "sub_A" }), makeSub({ id: "sub_B" })] });
    const { db } = mockDb();
    await link(stripe, db, trialProfile(), { checkoutSessionId: "cs_live_SESSION0001" });
    const all = logLines.join("\n");
    assert.ok(all.length > 0);
    assert.doesNotMatch(all, /cus_TESTCUSTOMER01|cs_live_SESSION0001|@/);
    assert.match(all, /\[billing-sync\]/);
  });

  it("Q: Refresh repairs a customer-without-subscription-id profile; page load recovers too", async () => {
    const { stripe } = mockStripe({ list: [makeSub()] });
    const { db, calls } = mockDb();
    const result = await link(stripe, db, trialProfile(), { source: "refresh" });
    assert.equal(result.ok, true);
    assert.equal(calls.patches[0].subscription_status, "active");

    assert.equal(
      shouldAutoSyncStripeSubscriptionOnBillingLoad({
        stripe_customer_id: CUSTOMER,
        stripe_subscription_id: null,
        subscription_status: "trial",
      }),
      true
    );
    assert.equal(
      shouldAutoSyncStripeSubscriptionOnBillingLoad({
        stripe_customer_id: null,
        stripe_subscription_id: null,
        subscription_status: "trial",
      }),
      false
    );
    assert.equal(
      shouldAutoSyncStripeSubscriptionOnBillingLoad({
        stripe_customer_id: CUSTOMER,
        stripe_subscription_id: null,
        subscription_status: "trial",
        beta_tester: true,
      }),
      false
    );
  });
});

// ---------------------------------------------------------------------------
// Basil API shapes
// ---------------------------------------------------------------------------

describe("Stripe 2025-05-28.basil compatibility", () => {
  it("O: period end comes from subscription items (earliest of several), legacy root as fallback", () => {
    assert.equal(subscriptionPeriodEndUnix(makeSub()), PERIOD_END);
    assert.equal(
      subscriptionPeriodEndUnix(
        makeSub({
          items: {
            data: [
              { id: "si_1", price: { id: "price_solo_standard" }, current_period_end: PERIOD_END + 500 },
              { id: "si_2", price: { id: "price_solo_standard" }, current_period_end: PERIOD_END },
              { id: "si_3", price: { id: "price_solo_standard" } },
            ],
          },
        })
      ),
      PERIOD_END
    );
    assert.equal(
      subscriptionPeriodEndUnix(makeSub({ items: { data: [] }, current_period_end: PERIOD_END })),
      PERIOD_END
    );
    assert.equal(subscriptionPeriodEndUnix(makeSub({ items: { data: [{ id: "si_1" }] } })), null);
    assert.equal(subscriptionPeriodEndUnix(null), null);
  });

  it("P: invoice → subscription from parent.subscription_details (string or object), with fallbacks", () => {
    const basilString = {
      id: "in_1",
      parent: { type: "subscription_details", subscription_details: { subscription: "sub_BASIL" } },
    } as unknown as Stripe.Invoice;
    assert.equal(invoiceSubscriptionId(basilString), "sub_BASIL");

    const basilObject = {
      id: "in_2",
      parent: { subscription_details: { subscription: { id: "sub_EXPANDED" } } },
    } as unknown as Stripe.Invoice;
    assert.equal(invoiceSubscriptionId(basilObject), "sub_EXPANDED");

    const legacy = { id: "in_3", subscription: "sub_LEGACY" } as unknown as Stripe.Invoice;
    assert.equal(invoiceSubscriptionId(legacy), "sub_LEGACY");

    const fromLines = {
      id: "in_4",
      parent: null,
      lines: { data: [{ parent: { subscription_item_details: { subscription: "sub_LINE" } } }] },
    } as unknown as Stripe.Invoice;
    assert.equal(invoiceSubscriptionId(fromLines), "sub_LINE");

    assert.equal(invoiceSubscriptionId({ id: "in_5", parent: null } as unknown as Stripe.Invoice), null);
  });

  it("webhook uses Basil helpers and checks every profile write", () => {
    const webhook = readFileSync(join(process.cwd(), "src/lib/stripe-billing-webhook.ts"), "utf8");
    assert.match(webhook, /invoiceSubscriptionId\(inv\)/);
    assert.match(webhook, /subscriptionPeriodEndUnix\(sub\)/);
    assert.doesNotMatch(webhook, /subscriptionIdFromBasilInvoice|subscriptionCurrentPeriodEndUnixFromBasilWebhook/);
    const profileUpdates = webhook.match(/\.from\("profiles"\)\s*\.update\(/g) ?? [];
    const asserts = webhook.match(/assertWebhookWrite\(/g) ?? [];
    // One helper definition + one call per profile update.
    assert.equal(asserts.length - 1, profileUpdates.length);
    // Markers updates for trial emails are not in this file; all subscription writes are checked.
    assert.ok(profileUpdates.length >= 6);
  });

  it("webhook route logs signature and handler failures without payloads", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/webhooks/stripe/route.ts"), "utf8");
    assert.match(route, /signature_verification_failed/);
    assert.match(route, /handler_failed/);
    assert.match(route, /idempotency_insert_failed/);
    assert.doesNotMatch(route, /logWebhook\([^)]*rawBody/);
  });
});

// ---------------------------------------------------------------------------
// Plan names
// ---------------------------------------------------------------------------

describe("customer-facing plan names", () => {
  it("R: Billing labels use Solo / Pro consistently", () => {
    assert.equal(getBillingPlanName("essential"), "Solo");
    assert.equal(getBillingPlanName("professional"), "Pro");
    assert.equal(betaPlanTierLabel("essential"), getBillingPlanName("essential"));
    assert.equal(betaPlanTierLabel("professional"), getBillingPlanName("professional"));
    assert.equal(getPlanDisplayLines("essential", "standard").planLine, "Solo — $39 CAD/month + applicable taxes");
    assert.equal(getPlanDisplayLines("professional", "standard").planLine, "Pro — $59 CAD/month + applicable taxes");
    assert.equal(getPlanDisplayLines("essential", "founder").planLine, "Solo Founder — $29 CAD/month + applicable taxes");
    assert.match(getUpgradeProfessionalButtonLabel("standard"), /^Upgrade to Pro — /);

    for (const file of [
      "src/app/(app)/settings/billing/page.tsx",
      "src/app/(app)/settings/billing/billing-actions-client.tsx",
    ]) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      const jsxText = src.match(/>[^<>{}]*</g)?.join("\n") ?? "";
      const strings = src.match(/"[^"\n]*"/g)?.join("\n") ?? "";
      assert.doesNotMatch(jsxText, /\bEssential\b|\bProfessional\b/, file);
      assert.doesNotMatch(strings, /\bEssential\b|\bProfessional\b/, file);
    }
  });

  it("R: GA4 item names are intentionally unchanged (analytics continuity)", () => {
    assert.equal(getPlanGa4ItemName("essential"), "Essential");
    assert.equal(getPlanGa4ItemName("professional"), "Professional");
  });
});

// ---------------------------------------------------------------------------
// GA4 purchase identity
// ---------------------------------------------------------------------------

describe("GA4 purchase identity after repair", () => {
  const base = {
    authSucceeded: true,
    checkoutSessionId: "cs_live_SESSION0001",
    sessionMode: "subscription",
    paymentStatus: "paid",
    sessionStatus: "complete",
    sessionCustomerMatchesProfile: true,
    sessionProfileMetadataMatches: true,
    sessionCreatedUnix: Math.floor(Date.now() / 1000) - 3600,
    checkoutSessionSubscriptionId: "sub_NEWPAIDSUB0001",
  };

  it("S: purchase stays ineligible until the profile holds the exact Checkout subscription", () => {
    const unlinked = evaluateGa4PurchaseEligibility({
      ...base,
      previousSubscriptionStatus: "trial",
      newSubscriptionStatus: "trial",
      profileStripeSubscriptionId: null,
    });
    assert.deepEqual(unlinked, { eligible: false, reason: "subscription_missing" });

    const wrongSub = evaluateGa4PurchaseEligibility({
      ...base,
      previousSubscriptionStatus: "trial",
      newSubscriptionStatus: "active",
      profileStripeSubscriptionId: "sub_SOMETHINGELSE",
    });
    assert.deepEqual(wrongSub, { eligible: false, reason: "subscription_id_mismatch" });
  });

  it("T: after legitimate repair within 48h, purchase becomes eligible", () => {
    // Page-load sync repaired the profile before the tracker ran (previous = active).
    const repaired = evaluateGa4PurchaseEligibility({
      ...base,
      previousSubscriptionStatus: "active",
      newSubscriptionStatus: "active",
      profileStripeSubscriptionId: "sub_NEWPAIDSUB0001",
    });
    assert.deepEqual(repaired, { eligible: true, reason: "webhook_race_recent_checkout" });

    const firstPaid = evaluateGa4PurchaseEligibility({
      ...base,
      previousSubscriptionStatus: "trial",
      newSubscriptionStatus: "active",
      profileStripeSubscriptionId: "sub_NEWPAIDSUB0001",
    });
    assert.deepEqual(firstPaid, { eligible: true, reason: "first_paid_transition" });

    const stale = evaluateGa4PurchaseEligibility({
      ...base,
      sessionCreatedUnix: Math.floor((Date.now() - 49 * 60 * 60 * 1000) / 1000),
      previousSubscriptionStatus: "active",
      newSubscriptionStatus: "active",
      profileStripeSubscriptionId: "sub_NEWPAIDSUB0001",
    });
    assert.equal(stale.eligible, false);
  });
});

// ---------------------------------------------------------------------------
// Scope guards
// ---------------------------------------------------------------------------

describe("scope guards", () => {
  const newModules = [
    "src/lib/stripe-subscription-link.ts",
    "src/lib/billing-page-state.ts",
    "src/lib/stripe-subscription-profile-sync.ts",
  ];

  it("U: Partner systems untouched — billing modules don't touch partner logic; webhook partner hooks intact", () => {
    for (const file of newModules) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      assert.doesNotMatch(src, /partner/i, file);
    }
    const webhook = readFileSync(join(process.cwd(), "src/lib/stripe-billing-webhook.ts"), "utf8");
    assert.equal((webhook.match(/syncPartnerReferralSubscriptionStatus\(/g) ?? []).length, 5);
  });

  it("V: signup / onboarding funnel analytics untouched", () => {
    const ga4 = readFileSync(join(process.cwd(), "src/lib/ga4.ts"), "utf8");
    for (const name of ["signup_view", "signup_start", "signup_submit", "sign_up", "signup_verified", "onboarding_start", "onboarding_complete"]) {
      assert.match(ga4, new RegExp(name));
    }
    assert.doesNotMatch(ga4, /begin_checkout|purchase/);
    for (const file of newModules) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      assert.doesNotMatch(src, /signup_|onboarding_complete|trackGa4/, file);
    }
  });
});
