import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildActivityFeed,
  resolveActivityOwner,
  UNKNOWN_ACTIVITY_OWNER,
  type ActivitySources,
} from "@/lib/admin/product-usage";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const betaProfile = { id: "p-beta", created_at: "2026-10-01T10:00:00Z" };
const normalProfile = { id: "p-normal", created_at: "2026-10-02T10:00:00Z" };

const sources: ActivitySources = {
  profiles: [betaProfile, normalProfile],
  jobs: [
    { profile_id: "p-beta", created_at: "2026-10-03T10:00:00Z" },
    { profile_id: "p-normal", created_at: "2026-10-04T10:00:00Z" },
  ],
  contracts: [{ profile_id: "p-normal", status: "signed", signed_at: "2026-10-05T10:00:00Z", sent_at: "2026-10-05T09:00:00Z" }],
  estimates: [],
  invoices: [],
  payments: [{ profile_id: "p-normal", paid_on: "2026-10-06T10:00:00Z" }],
};

const emailByProfileId = new Map([
  ["p-beta", "beta@example.com"],
  ["p-normal", "normal@example.com"],
]);

describe("admin activity feed vs beta filter", () => {
  it("unfiltered feed is newest-first and every owner resolves", () => {
    const feed = buildActivityFeed(sources);
    assert.equal(feed[0].label, "Payment recorded");
    for (const e of feed) {
      assert.notEqual(resolveActivityOwner(e.pid, emailByProfileId), UNKNOWN_ACTIVITY_OWNER, e.label);
    }
  });

  it("beta filter scopes the feed and owners still resolve from the full map", () => {
    const feed = buildActivityFeed(sources, { allowedProfileIds: new Set(["p-beta"]) });
    assert.deepEqual(feed.map((e) => e.label).sort(), ["Job created", "New account created"]);
    for (const e of feed) {
      assert.equal(e.pid, "p-beta");
      assert.equal(resolveActivityOwner(e.pid, emailByProfileId), "beta@example.com");
    }
  });

  it("non-beta filter never shows beta activity or unknown owners", () => {
    const feed = buildActivityFeed(sources, { allowedProfileIds: new Set(["p-normal"]) });
    assert.ok(feed.length >= 4);
    assert.ok(feed.every((e) => e.pid === "p-normal"));
    assert.ok(feed.every((e) => resolveActivityOwner(e.pid, emailByProfileId) === "normal@example.com"));
  });

  it("only genuinely orphaned rows fall back to unknown user", () => {
    assert.equal(resolveActivityOwner("deleted-profile", emailByProfileId), UNKNOWN_ACTIVITY_OWNER);
    assert.equal(resolveActivityOwner("p-beta", new Map([["p-beta", "-"]])), UNKNOWN_ACTIVITY_OWNER);
  });

  it("respects the limit and drops undated rows", () => {
    const many: ActivitySources = {
      ...sources,
      jobs: Array.from({ length: 80 }, (_, i) => ({ profile_id: "p-beta", created_at: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z` })),
    };
    assert.equal(buildActivityFeed(many).length, 50);
    assert.equal(buildActivityFeed({ ...sources, jobs: [{ profile_id: "p-beta" }] }, { limit: 100 }).every((e) => e.at), true);
  });
});

describe("product usage page wiring", () => {
  const page = read("src/app/admin/usage/page.tsx");

  it("resolves activity owners from the full profile map, not the filtered subset", () => {
    assert.match(page, /resolveActivityOwner\(a\.pid, emailByProfileId\)/);
    assert.doesNotMatch(page, /userActivity\.find\(/);
    assert.match(page, /buildActivityFeed\(/);
  });

  it("links attention panels and tables to contractor detail pages", () => {
    assert.match(page, /href=\{`\/admin\/users\/\$\{u\.profileId\}`\}/);
    assert.equal((page.match(/profileId: u\.profileId/g) ?? []).length, 4);
    assert.match(read("src/components/admin/usage/needs-panel.tsx"), /href=\{`\/admin\/users\/\$\{r\.profileId\}`\}/);
  });

  it("keeps the beta filter and legacy /admin?beta= bookmarks working", () => {
    assert.match(page, /\/admin\/usage\?beta=/);
    const overview = read("src/app/admin/page.tsx");
    assert.match(overview, /redirect\(`\/admin\/usage\?beta=\$\{legacyBeta\}`\)/);
  });

  it("is authorized server-side", () => {
    assert.match(page, /requireAdminUserOrRedirectLogin\(/);
    assert.match(page, /AdminNotAuthorized/);
  });
});
