import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  ADMIN_BACK_TO_APP_HREF,
  ADMIN_NAV_GROUPS,
  ADMIN_PLANNED_NAV,
  allAdminNavItems,
  resolveActiveNavItem,
} from "@/lib/admin/navigation";
import { buildAttentionItems } from "@/lib/admin/overview-metrics";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** `/admin/partners/payouts` -> src/app/admin/partners/payouts/page.tsx (or route.ts) */
function routeExists(href: string): boolean {
  const path = href.split("#")[0].split("?")[0];
  const dir = join(root, "src/app", path);
  return existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "route.ts"));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe("admin navigation route integrity", () => {
  const items = allAdminNavItems();

  it("every navigation link points at an existing admin page", () => {
    assert.ok(items.length >= 6);
    for (const item of items) {
      assert.ok(item.href.startsWith("/admin"), item.href);
      assert.ok(routeExists(item.href), `${item.label} -> ${item.href} has no page`);
    }
  });

  it("links and labels are unique, and groups are non-empty", () => {
    assert.equal(new Set(items.map((i) => i.href)).size, items.length);
    assert.equal(new Set(items.map((i) => i.label)).size, items.length);
    for (const g of ADMIN_NAV_GROUPS) assert.ok(g.items.length > 0, g.id);
  });

  it("unfinished sections are hidden, not rendered as empty pages", () => {
    const visible = new Set(items.map((i) => i.label));
    for (const planned of ADMIN_PLANNED_NAV) {
      assert.equal(visible.has(planned.label), false, `${planned.label} should stay hidden until built`);
    }
    for (const label of ["Contractors", "Subscriptions", "Support", "Platform Health", "Reports", "Settings"]) {
      assert.ok(ADMIN_PLANNED_NAV.some((p) => p.label === label), label);
    }
    for (const dir of ["contractors", "subscriptions", "support", "health", "reports", "settings"]) {
      assert.equal(existsSync(join(root, "src/app/admin", dir, "page.tsx")), false, `unexpected stub admin/${dir}`);
    }
  });

  it("the requested group structure is preserved where pages exist", () => {
    const labels = Object.fromEntries(ADMIN_NAV_GROUPS.map((g) => [g.label, g.items.map((i) => i.label)]));
    assert.deepEqual(labels["Dashboard"].slice(0, 1), ["Overview"]);
    assert.deepEqual(labels["Partners"], ["Partner Management", "Partner Payouts"]);
  });

  it("every existing static admin page is reachable from the navigation", () => {
    const pages = walk(join(root, "src/app/admin"))
      .map((f) => relative(join(root, "src/app"), f).replace(/\\/g, "/"))
      .filter((f) => /\/page\.tsx$|\/route\.ts$/.test(f))
      .map((f) => "/" + f.replace(/\/(page\.tsx|route\.ts)$/, ""))
      .map((p) => p.replace(/\[[^\]]+\]/g, "x"));
    assert.ok(pages.length >= 10);
    for (const p of pages) {
      assert.ok(resolveActiveNavItem(p), `${p} is not covered by any nav item`);
    }
  });

  it("alert card destinations are existing admin pages", () => {
    const ok = (n: number) => ({ ok: true as const, value: n });
    const alerts = buildAttentionItems({
      partnerApplicationsAwaitingReview: ok(1),
      rewardsReadyForPayout: ok(1),
      rewardsNeedingReview: ok(1),
      pastDueContractors: ok(1),
      trialsEndingSoon: ok(1),
    });
    for (const a of alerts) {
      assert.ok(routeExists(a.href), `${a.id} -> ${a.href}`);
    }
    // Hash targets must exist on the overview.
    const followUp = read("src/components/admin/overview/account-follow-up.tsx");
    for (const a of alerts.filter((x) => x.href.includes("#"))) {
      const anchor = a.href.split("#")[1];
      assert.ok(
        a.href.startsWith("/admin#") && (anchor === "past-due-accounts" || anchor === "trials-ending-soon"),
        a.href
      );
    }
    assert.match(followUp, /PAST_DUE_ANCHOR/);
    assert.match(followUp, /TRIALS_ENDING_ANCHOR/);
  });
});

describe("active navigation state", () => {
  const label = (p: string) => resolveActiveNavItem(p)?.label ?? null;

  it("highlights the right section, including nested routes", () => {
    assert.equal(label("/admin"), "Overview");
    assert.equal(label("/admin/"), "Overview");
    assert.equal(label("/admin?beta=beta"), "Overview");
    assert.equal(label("/admin/usage"), "Product usage");
    assert.equal(label("/admin/usage?beta=beta"), "Product usage");
    assert.equal(label("/admin/users/abc-123"), "Product usage");
    assert.equal(label("/admin/partners"), "Partner Management");
    assert.equal(label("/admin/partners/"), "Partner Management");
    assert.equal(label("/admin/partners/payouts"), "Partner Payouts");
    assert.equal(label("/admin/partners/payouts/abc"), "Partner Payouts");
    assert.equal(label("/admin/partners/payouts/history/xyz"), "Partner Payouts");
    assert.equal(label("/admin/waitlist"), "Early access signups");
    assert.equal(label("/admin/waitlist/export"), "Early access signups");
    assert.equal(label("/admin/analytics"), "Product analytics");
    assert.equal(label("/admin/stripe-readiness"), "Stripe readiness");
  });

  it("Overview never swallows other pages, and unknown routes highlight nothing", () => {
    assert.notEqual(label("/admin/partners"), "Overview");
    assert.equal(label("/admin/does-not-exist"), null);
    assert.equal(label("/admin-other"), null);
    assert.equal(label("/dashboard"), null);
  });
});

describe("responsive navigation components", () => {
  const nav = read("src/components/admin/admin-nav.tsx");
  const sidebar = read("src/components/admin/admin-sidebar.tsx");
  const mobile = read("src/components/admin/admin-mobile-nav.tsx");
  const layout = read("src/app/admin/layout.tsx");

  it("desktop sidebar and mobile drawer share one nav component", () => {
    assert.match(sidebar, /<AdminNav\s*\/>/);
    assert.match(mobile, /<AdminNav onNavigate=\{close\}\s*\/>/);
    assert.equal((nav.match(/ADMIN_NAV_GROUPS\.map/g) ?? []).length, 1);
    assert.doesNotMatch(sidebar, /ADMIN_NAV_GROUPS/);
    assert.doesNotMatch(mobile, /ADMIN_NAV_GROUPS/);
  });

  it("sidebar is desktop-only and the drawer is mobile-only", () => {
    assert.match(sidebar, /hidden[^"]*lg:flex/);
    assert.match(mobile, /lg:hidden/);
    assert.match(layout, /<AdminSidebar/);
    assert.match(layout, /<AdminMobileNav/);
  });

  it("marks the active item and supports keyboard users", () => {
    assert.match(nav, /aria-current=\{isActive \? "page" : undefined\}/);
    assert.match(nav, /aria-label="Admin sections"/);
    assert.match(nav, /focus-visible:ring-2/);
    assert.match(nav, /min-h-\[44px\]/);
  });

  it("the drawer is an accessible modal dialog", () => {
    assert.match(mobile, /aria-expanded=\{open\}/);
    assert.match(mobile, /aria-controls=\{panelId\}/);
    assert.match(mobile, /role="dialog"/);
    assert.match(mobile, /aria-modal="true"/);
    assert.match(mobile, /event\.key === "Escape"/);
    assert.match(mobile, /event\.key !== "Tab"/);
    assert.match(mobile, /trigger\?\.focus\(\)/);
    assert.match(mobile, /aria-label="Open admin navigation"/);
    assert.match(mobile, /aria-label="Close admin navigation"/);
  });

  it("links back to the main app and keeps Sign out in the header", () => {
    assert.equal(ADMIN_BACK_TO_APP_HREF, "/dashboard");
    assert.match(nav, /Back to JobProof app/);
    assert.match(nav, /ADMIN_BACK_TO_APP_HREF/);
    assert.match(read("src/app/admin/admin-header.tsx"), /AdminSignOutButton/);
  });
});
