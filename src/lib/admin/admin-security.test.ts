import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { isAdminEmail, parseAdminEmails } from "@/lib/admin-auth";
import { ADMIN_LOGIN_PATH, buildAdminLoginPath } from "@/lib/admin-constants";
import {
  isAdminPath,
  resolveAuthenticatedAuthPathRedirect,
  resolveSafeLoginRedirect,
} from "@/lib/auth/safe-redirect";
import {
  ADMIN_RESPONSE_HEADERS,
  resolveAdminMiddlewareRedirect,
} from "@/lib/admin/middleware-guard";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe("admin path + login redirect safety", () => {
  it("isAdminPath accepts only the admin area", () => {
    for (const ok of ["/admin", "/admin/", "/admin/users/abc-123", "/admin?beta=beta", "/admin/partners/payouts"]) {
      assert.equal(isAdminPath(ok), true, ok);
    }
    for (const bad of [
      "/administrator",
      "/adminx",
      "//admin",
      "//evil.com/admin",
      "/admin/../dashboard",
      "https://evil.com/admin",
      "http://evil.com",
      "javascript:alert(1)",
      "/dashboard",
      "admin",
      "",
      "   ",
      null,
      undefined,
    ]) {
      assert.equal(isAdminPath(bad as string | null | undefined), false, String(bad));
    }
  });

  it("buildAdminLoginPath preserves safe deep links and never an external target", () => {
    assert.equal(buildAdminLoginPath(), ADMIN_LOGIN_PATH);
    assert.equal(buildAdminLoginPath("/admin"), ADMIN_LOGIN_PATH);
    assert.equal(
      buildAdminLoginPath("/admin/users/abc-123"),
      `/login?next=${encodeURIComponent("/admin/users/abc-123")}`
    );
    assert.equal(
      buildAdminLoginPath("/admin/usage?beta=beta"),
      `/login?next=${encodeURIComponent("/admin/usage?beta=beta")}`
    );
    for (const evil of ["https://evil.com", "//evil.com", "/dashboard", "/admin/../etc", "javascript:x"]) {
      assert.equal(buildAdminLoginPath(evil), ADMIN_LOGIN_PATH, evil);
    }
  });

  it("login `next` resolves admin deep links but blocks external redirects", () => {
    assert.equal(resolveSafeLoginRedirect("/admin/users/abc"), "/admin/users/abc");
    assert.equal(resolveSafeLoginRedirect("https://evil.com/admin"), "/dashboard");
    assert.equal(resolveSafeLoginRedirect("//evil.com"), "/dashboard");
    assert.equal(resolveSafeLoginRedirect("javascript:alert(1)"), "/dashboard");
  });

  it("authenticated /login honours admin deep links, never unsafe ones", () => {
    const fallback = "/dashboard";
    assert.equal(
      resolveAuthenticatedAuthPathRedirect({ next: "/admin/users/abc", contractorFallbackPath: fallback }),
      "/admin/users/abc"
    );
    assert.equal(
      resolveAuthenticatedAuthPathRedirect({ next: "//evil.com", contractorFallbackPath: fallback }),
      fallback
    );
    assert.equal(
      resolveAuthenticatedAuthPathRedirect({ next: "/admin/../dashboard", contractorFallbackPath: fallback }),
      fallback
    );
    assert.equal(
      resolveAuthenticatedAuthPathRedirect({ next: "/partner/status", contractorFallbackPath: fallback }),
      "/partner/status"
    );
    assert.equal(
      resolveAuthenticatedAuthPathRedirect({ next: null, contractorFallbackPath: fallback }),
      fallback
    );
  });

  it("login page recognises admin deep links (not just an exact /admin match)", () => {
    const login = read("src/app/(auth)/login/page.tsx");
    assert.match(login, /isAdminLogin = isAdminPath\(redirectParam\)/);
    assert.doesNotMatch(login, /redirectParam === "\/admin"/);
  });
});

describe("admin middleware guard", () => {
  it("redirects anonymous admin requests to login with the deep link preserved", () => {
    assert.equal(
      resolveAdminMiddlewareRedirect({ pathname: "/admin", hasSession: false }),
      ADMIN_LOGIN_PATH
    );
    assert.equal(
      resolveAdminMiddlewareRedirect({ pathname: "/admin/users/abc", search: "?tab=billing", hasSession: false }),
      `/login?next=${encodeURIComponent("/admin/users/abc?tab=billing")}`
    );
    assert.equal(
      resolveAdminMiddlewareRedirect({ pathname: "/admin/partners/payouts", hasSession: false }),
      `/login?next=${encodeURIComponent("/admin/partners/payouts")}`
    );
  });

  it("lets signed-in users continue (authorization stays server-side) and ignores non-admin paths", () => {
    assert.equal(resolveAdminMiddlewareRedirect({ pathname: "/admin/users/abc", hasSession: true }), null);
    assert.equal(resolveAdminMiddlewareRedirect({ pathname: "/dashboard", hasSession: false }), null);
    assert.equal(resolveAdminMiddlewareRedirect({ pathname: "/administrator", hasSession: false }), null);
    assert.equal(resolveAdminMiddlewareRedirect({ pathname: "/login", hasSession: false }), null);
  });

  it("admin responses are uncacheable and not indexable", () => {
    assert.match(ADMIN_RESPONSE_HEADERS["Cache-Control"], /no-store/);
    assert.match(ADMIN_RESPONSE_HEADERS["X-Robots-Tag"], /noindex/);
  });

  it("middleware wires the guard and does not push admins into contractor onboarding", () => {
    const mw = code(read("src/middleware.ts"));
    assert.match(mw, /resolveAdminMiddlewareRedirect\(/);
    assert.match(mw, /ADMIN_RESPONSE_HEADERS/);
    const onboarding = mw.slice(mw.indexOf("const PATHS_REQUIRING_ONBOARDING"), mw.indexOf("];", mw.indexOf("const PATHS_REQUIRING_ONBOARDING")));
    assert.doesNotMatch(onboarding, /"\/admin/);
    // Middleware must not be the authorization check: no allowlist logic there.
    assert.doesNotMatch(mw, /ADMIN_EMAILS|isAdminEmail/);
  });
});

describe("ADMIN_EMAILS authorization (unchanged mechanism)", () => {
  const original = process.env.ADMIN_EMAILS;
  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  });

  it("an empty or missing allowlist authorizes nobody", () => {
    delete process.env.ADMIN_EMAILS;
    assert.deepEqual(parseAdminEmails(), []);
    assert.equal(isAdminEmail("owner@example.com"), false);
    process.env.ADMIN_EMAILS = "  ,, ";
    assert.equal(isAdminEmail("owner@example.com"), false);
  });

  it("matches allowlisted emails case-insensitively and rejects everyone else", () => {
    process.env.ADMIN_EMAILS = " Owner@Example.com , ops@example.com ";
    assert.equal(isAdminEmail("owner@example.com"), true);
    assert.equal(isAdminEmail("OPS@EXAMPLE.COM"), true);
    assert.equal(isAdminEmail("contractor@example.com"), false);
    assert.equal(isAdminEmail("owner@example.com.evil.com"), false);
    assert.equal(isAdminEmail(null), false);
    assert.equal(isAdminEmail(undefined), false);
    assert.equal(isAdminEmail(""), false);
  });
});

describe("server-side authorization is enforced on every admin surface", () => {
  const adminDir = join(root, "src/app/admin");
  const files = walk(adminDir).map((f) => relative(root, f).replace(/\\/g, "/"));

  it("every admin page.tsx authorizes server-side (not middleware alone)", () => {
    const pages = files.filter((f) => f.endsWith("/page.tsx"));
    assert.ok(pages.length >= 9, `expected admin pages, found ${pages.length}`);
    for (const page of pages) {
      assert.match(read(page), /requireAdminUserOrRedirectLogin\(/, page);
    }
  });

  it("deep-linked admin pages pass their own path so login returns to them", () => {
    assert.match(read("src/app/admin/users/[userId]/page.tsx"), /requireAdminUserOrRedirectLogin\(\s*`\/admin\/users\//);
    assert.match(read("src/app/admin/partners/payouts/[partnerId]/page.tsx"), /requireAdminUserOrRedirectLogin\(\s*`\/admin\/partners\/payouts\//);
    assert.match(read("src/app/admin/usage/page.tsx"), /requireAdminUserOrRedirectLogin\(/);
    const auth = read("src/lib/admin-auth.ts");
    assert.match(auth, /buildAdminLoginPath\(nextPath\)/);
  });

  it("route handlers authorize and distinguish 401 from 403", () => {
    const route = read("src/app/admin/waitlist/export/route.ts");
    assert.ok(route.indexOf("requireAdminUser()") < route.indexOf("SUPABASE_SERVICE_ROLE_KEY"));
    assert.match(route, /401/);
    assert.match(route, /403/);
    assert.match(route, /reason === "unauthenticated"/);
  });

  it("requireAdminService checks the allowlist before ever creating the service-role client", () => {
    const svc = read("src/lib/admin-service.ts");
    assert.ok(svc.indexOf("requireAdminUser()") !== -1);
    assert.ok(svc.indexOf("requireAdminUser()") < svc.indexOf("createServiceRoleClient()"));
    assert.match(svc, /if \(!auth\.ok\) return \{ ok: false as const, error: "Unauthorized" \}/);
  });

  it("every exported admin server action calls requireAdminService first", () => {
    for (const rel of [
      "src/app/admin/partners/actions.ts",
      "src/app/admin/partners/payout-actions.ts",
    ]) {
      const src = read(rel);
      assert.match(src, /^"use server";/);
      const parts = src.split(/^export async function /m).slice(1);
      assert.ok(parts.length >= 5, rel);
      for (const part of parts) {
        const name = part.slice(0, part.indexOf("("));
        const guardAt = part.indexOf("await requireAdminService()");
        assert.ok(guardAt !== -1, `${rel}: ${name} has no requireAdminService() guard`);
        // Nothing touches the database before the guard.
        assert.ok(
          part.indexOf(".from(") === -1 || guardAt < part.indexOf(".from("),
          `${rel}: ${name} queries before authorizing`
        );
        assert.match(part, /if \(!ctx\.ok\) return ctx;/, `${rel}: ${name}`);
      }
    }
  });

  it("the service-role key never reaches client bundles", () => {
    const clientFiles = walk(join(root, "src"))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts"))
      .filter((f) => /^\s*["']use client["'];?/m.test(readFileSync(f, "utf8").slice(0, 400)));
    assert.ok(clientFiles.length > 0);
    for (const f of clientFiles) {
      const src = readFileSync(f, "utf8");
      assert.doesNotMatch(src, /SUPABASE_SERVICE_ROLE_KEY|supabase\/service-role|createServiceRoleClient/, f);
    }
    const publicEnv = read("src/lib/supabase/client.ts");
    assert.doesNotMatch(publicEnv, /SERVICE_ROLE/);
    for (const rel of walk(join(root, "src")).filter((f) => /\.(ts|tsx)$/.test(f))) {
      assert.doesNotMatch(readFileSync(rel, "utf8"), /NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE/, rel);
    }
  });

  it("the admin layout only renders navigation for an allowlisted admin", () => {
    const layout = read("src/app/admin/layout.tsx");
    assert.match(layout, /requireAdminUser\(\)/);
    assert.ok(layout.indexOf("if (!auth.ok)") < layout.indexOf("<AdminSidebar"));
  });

  it("all admin page files exist at the expected routes (no route removed)", () => {
    for (const rel of [
      "src/app/admin/page.tsx",
      "src/app/admin/usage/page.tsx",
      "src/app/admin/waitlist/page.tsx",
      "src/app/admin/waitlist/export/route.ts",
      "src/app/admin/analytics/page.tsx",
      "src/app/admin/stripe-readiness/page.tsx",
      "src/app/admin/users/[userId]/page.tsx",
      "src/app/admin/partners/page.tsx",
      "src/app/admin/partners/payouts/page.tsx",
      "src/app/admin/partners/payouts/[partnerId]/page.tsx",
      "src/app/admin/partners/payouts/history/[payoutId]/page.tsx",
    ]) {
      assert.ok(existsSync(join(root, rel)), rel);
    }
  });
});
