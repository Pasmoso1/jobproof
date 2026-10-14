import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  ANALYTICS_APPROVED_HOSTNAMES,
  isAnalyticsAllowedHostname,
} from "@/lib/analytics-environment";
import { GA4_APPROVED_HOSTNAMES, isGa4AllowedHostname } from "@/lib/ga4-environment";
import { META_PIXEL_ID, buildMetaPixelBootstrapScript } from "@/lib/meta-pixel-environment";
import { trackEvent as trackMetaEvent } from "@/lib/metaPixel";

const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "10.0.0.5",
  "172.16.4.2",
  "192.168.1.20",
  "my-laptop.local",
  "jobproof-git-feature-jeff.vercel.app",
  "jobproof.vercel.app",
  "staging.jobproof.ca",
  "app.jobproof.ca",
  "jobproof.ca.attacker.com",
  "jobproof.com",
  "",
];

type FakeFbq = ((...args: unknown[]) => void) & { queue?: unknown[][] };

/** Runs the real inline Meta bootstrap against a fake page and reports what it touched. */
function runMetaBootstrap(hostname: string) {
  const script = buildMetaPixelBootstrapScript();
  assert.ok(script, "bootstrap script is built for the production config");
  const win: { location: { hostname: string }; fbq?: FakeFbq; _fbq?: unknown } = {
    location: { hostname },
  };
  const inserted: Array<{ src: string; async: boolean }> = [];
  const anchor = {
    parentNode: { insertBefore: (el: { src: string; async: boolean }) => inserted.push(el) },
  };
  const doc = {
    createElement: () => ({ src: "", async: false }),
    getElementsByTagName: () => [anchor],
  };
  new Function("window", "document", script)(win, doc);
  return { win, inserted };
}

function installWindow(hostname: string) {
  const calls: unknown[][] = [];
  (globalThis as { window?: unknown }).window = {
    fbq: (...args: unknown[]) => void calls.push(args),
    location: { hostname },
  };
  return calls;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("shared analytics hostname rules", () => {
  it("GA4 and Meta Pixel use the same approved hostnames", () => {
    assert.deepEqual([...ANALYTICS_APPROVED_HOSTNAMES].sort(), ["jobproof.ca", "www.jobproof.ca"]);
    assert.equal(GA4_APPROVED_HOSTNAMES, ANALYTICS_APPROVED_HOSTNAMES);
    const metaSource = readFileSync(join(process.cwd(), "src/lib/meta-pixel-environment.ts"), "utf8");
    const pixelHelper = readFileSync(join(process.cwd(), "src/lib/metaPixel.ts"), "utf8");
    assert.match(metaSource, /ANALYTICS_APPROVED_HOSTNAMES/);
    assert.match(pixelHelper, /isAnalyticsAllowedInBrowser\(\)/);
  });

  for (const host of BLOCKED_HOSTS) {
    it(`blocks ${host || "(empty hostname)"} for every tag`, () => {
      assert.equal(isAnalyticsAllowedHostname(host), false);
      assert.equal(isGa4AllowedHostname(host), false);
    });
  }

  it("allows the production domain", () => {
    assert.equal(isAnalyticsAllowedHostname("www.jobproof.ca"), true);
    assert.equal(isAnalyticsAllowedHostname("jobproof.ca"), true);
  });
});

describe("Meta Pixel bootstrap", () => {
  for (const host of ["localhost", "127.0.0.1", "192.168.1.20", "jobproof-git-feature-jeff.vercel.app"]) {
    it(`does not initialize, load fbevents.js or queue a PageView on ${host}`, () => {
      const { win, inserted } = runMetaBootstrap(host);
      assert.equal(win.fbq, undefined);
      assert.equal(win._fbq, undefined);
      assert.equal(inserted.length, 0, "no request for fbevents.js");
    });
  }

  it("keeps Meta's base code on production: init with the pixel ID, then one PageView", () => {
    const { win, inserted } = runMetaBootstrap("www.jobproof.ca");
    assert.equal(typeof win.fbq, "function");
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].src, "https://connect.facebook.net/en_US/fbevents.js");
    assert.equal(inserted[0].async, true);
    const queued = (win.fbq?.queue ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));
    assert.deepEqual(queued, [
      ["init", META_PIXEL_ID],
      ["track", "PageView"],
    ]);
  });

  it("fails safe (renders no pixel) when the configuration is invalid", () => {
    assert.equal(buildMetaPixelBootstrapScript(""), null);
    assert.equal(buildMetaPixelBootstrapScript("abc"), null);
    assert.equal(buildMetaPixelBootstrapScript("1234567890'); alert(1); ('"), null);
    assert.equal(buildMetaPixelBootstrapScript(META_PIXEL_ID, []), null);
  });
});

describe("Meta Pixel events", () => {
  const EVENTS: Array<[string, Record<string, unknown>]> = [
    ["PageView", {}],
    ["CompleteRegistration", { content_name: "contractor_signup" }],
    ["StartTrial", { content_name: "contractor_trial", currency: "CAD", value: 0 }],
  ];

  it("are sent unchanged on the production domain", () => {
    const calls = installWindow("www.jobproof.ca");
    for (const [name, params] of EVENTS) trackMetaEvent(name, params);
    assert.deepEqual(
      calls,
      EVENTS.map(([name, params]) => ["track", name, params])
    );
  });

  for (const host of ["localhost", "127.0.0.1", "10.0.0.5", "jobproof.vercel.app"]) {
    it(`are never sent on ${host}, even if an fbq function exists`, () => {
      const calls = installWindow(host);
      for (const [name, params] of EVENTS) trackMetaEvent(name, params);
      assert.equal(calls.length, 0);
    });
  }

  it("local production builds (NODE_ENV=production on localhost) send nothing", () => {
    const previous = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    try {
      const calls = installWindow("localhost");
      trackMetaEvent("CompleteRegistration", { content_name: "contractor_signup" });
      assert.equal(calls.length, 0);
      assert.equal(runMetaBootstrap("localhost").inserted.length, 0);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = previous;
    }
  });
});

describe("root layout", () => {
  it("installs both tags only through the hostname-gated builders, with no <noscript> pixel", () => {
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    assert.doesNotMatch(layout, /26827091406927437|fbevents|facebook\.com\/tr/);
    assert.doesNotMatch(layout, /<noscript/);
    assert.match(layout, /const metaPixelBootstrapScript = buildMetaPixelBootstrapScript\(\);/);
    assert.equal(layout.match(/<Script id="meta-pixel"/g)?.length, 1);
    assert.equal(layout.match(/<Script id="google-analytics"/g)?.length, 1);
  });
});
