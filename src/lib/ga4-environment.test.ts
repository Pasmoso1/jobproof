import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  GA4_APPROVED_HOSTNAMES,
  GA4_MEASUREMENT_ID,
  buildGa4BootstrapScript,
  isGa4AllowedHostname,
  isGa4AllowedInBrowser,
} from "@/lib/ga4-environment";
import { GA4_FUNNEL_EVENTS, trackGa4Event, waitForGa4Ready } from "@/lib/ga4";
import { GA4_BILLING_EVENTS } from "@/lib/ga4-billing";

const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "192.168.1.20",
  "jobproof.local",
  "jobproof-git-feature-jeff.vercel.app",
  "jobproof.vercel.app",
  "staging.jobproof.ca",
  "preview.jobproof.ca",
  "jobproof.ca.attacker.com",
  "wwwjobproof.ca",
  "",
];

type FakeWindow = {
  location: { hostname: string };
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

/** Runs the real inline bootstrap against a fake page and reports what it touched. */
function runBootstrap(hostname: string, script = buildGa4BootstrapScript()) {
  assert.ok(script, "bootstrap script is built for the production config");
  const win: FakeWindow = { location: { hostname } };
  const appended: Array<{ src: string; async: boolean }> = [];
  const doc = {
    createElement: () => ({ src: "", async: false }),
    head: { appendChild: (el: { src: string; async: boolean }) => appended.push(el) },
  };
  new Function("window", "document", script)(win, doc);
  return { win, appended };
}

function installWindow(hostname: string) {
  const calls: unknown[][] = [];
  (globalThis as { window?: unknown }).window = {
    gtag: (...args: unknown[]) => void calls.push(args),
    location: { hostname, search: "", pathname: "/" },
  };
  return calls;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("GA4 approved hostnames", () => {
  it("allows only the production JobProof domain", () => {
    assert.deepEqual([...GA4_APPROVED_HOSTNAMES].sort(), ["jobproof.ca", "www.jobproof.ca"]);
    assert.equal(isGa4AllowedHostname("www.jobproof.ca"), true);
    assert.equal(isGa4AllowedHostname("jobproof.ca"), true);
    assert.equal(isGa4AllowedHostname("WWW.JobProof.ca."), true, "case and trailing dot normalized");
  });

  for (const host of BLOCKED_HOSTS) {
    it(`blocks ${host || "(empty hostname)"}`, () => {
      assert.equal(isGa4AllowedHostname(host), false);
    });
  }

  it("is false during server rendering", () => {
    assert.equal(isGa4AllowedInBrowser(), false);
  });
});

describe("GA4 bootstrap script", () => {
  for (const host of ["localhost", "127.0.0.1", "jobproof-git-feature-jeff.vercel.app"]) {
    it(`does not load gtag.js, define gtag or queue a page_view on ${host}`, () => {
      const { win, appended } = runBootstrap(host);
      assert.equal(appended.length, 0, "no network request for gtag.js");
      assert.equal(win.gtag, undefined);
      assert.equal(win.dataLayer, undefined);
    });
  }

  it("installs the tag once on the production domain with a single automatic page_view", () => {
    const { win, appended } = runBootstrap("www.jobproof.ca");
    assert.equal(typeof win.gtag, "function");
    assert.equal(appended.length, 1);
    assert.equal(
      appended[0].src,
      `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`
    );
    assert.equal(appended[0].async, true);
    const queued = (win.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));
    assert.equal(queued.length, 2);
    assert.equal(queued[0][0], "js");
    assert.deepEqual(queued[1], ["config", GA4_MEASUREMENT_ID]);
    assert.equal(
      queued.filter((args) => args[0] === "event" && args[1] === "page_view").length,
      0,
      "page_view comes only from config — never a second manual hit"
    );
  });

  it("local production builds (NODE_ENV=production on localhost) still do not track", () => {
    const previous = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    try {
      const { win, appended } = runBootstrap("localhost", buildGa4BootstrapScript());
      assert.equal(appended.length, 0);
      assert.equal(win.gtag, undefined);
      const calls = installWindow("localhost");
      assert.equal(trackGa4Event(GA4_FUNNEL_EVENTS.sign_up), false);
      assert.equal(calls.length, 0);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = previous;
    }
  });

  it("fails safe (renders no tag) when the analytics configuration is missing or invalid", () => {
    assert.equal(buildGa4BootstrapScript(""), null);
    assert.equal(buildGa4BootstrapScript("UA-12345-1"), null);
    assert.equal(buildGa4BootstrapScript("G-74H8WQ0KQ4'); alert(1); ('"), null);
    assert.equal(buildGa4BootstrapScript(GA4_MEASUREMENT_ID, []), null);
  });
});

describe("GA4 event helpers follow the same hostname rule", () => {
  const PRODUCTION_EVENTS = [
    GA4_FUNNEL_EVENTS.sign_up,
    GA4_FUNNEL_EVENTS.signup_verified,
    GA4_FUNNEL_EVENTS.onboarding_start,
    GA4_FUNNEL_EVENTS.onboarding_plan_selected,
    GA4_FUNNEL_EVENTS.onboarding_complete,
    GA4_FUNNEL_EVENTS.trial_started,
    GA4_BILLING_EVENTS.begin_checkout,
    GA4_BILLING_EVENTS.purchase,
  ];

  it("keeps the production funnel event names unchanged", () => {
    assert.deepEqual(PRODUCTION_EVENTS, [
      "sign_up",
      "signup_verified",
      "onboarding_start",
      "onboarding_plan_selected",
      "onboarding_complete",
      "trial_started",
      "begin_checkout",
      "purchase",
    ]);
  });

  it("sends every funnel event with unchanged parameters on the production domain", () => {
    const calls = installWindow("www.jobproof.ca");
    for (const event of PRODUCTION_EVENTS) {
      assert.equal(trackGa4Event(event, { plan_tier: "essential" }), true);
    }
    assert.deepEqual(
      calls,
      PRODUCTION_EVENTS.map((event) => ["event", event, { plan_tier: "essential" }])
    );
  });

  for (const host of ["localhost", "127.0.0.1", "jobproof-git-feature-jeff.vercel.app"]) {
    it(`sends nothing on ${host}, even if a gtag function exists`, () => {
      const calls = installWindow(host);
      for (const event of PRODUCTION_EVENTS) {
        assert.equal(trackGa4Event(event), false);
      }
      assert.equal(calls.length, 0);
    });
  }

  it("does not poll for gtag on blocked hosts", async () => {
    (globalThis as { window?: unknown }).window = { location: { hostname: "localhost" } };
    const started = Date.now();
    assert.equal(await waitForGa4Ready(5_000, 50), false);
    assert.ok(Date.now() - started < 200);
  });
});
