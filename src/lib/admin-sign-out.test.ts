import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("admin Sign out chrome", () => {
  it("shared admin layout renders AdminHeader on all admin pages", () => {
    const layout = read("src/app/admin/layout.tsx");
    assert.match(layout, /AdminHeader/);
    assert.match(layout, /\{children\}/);
  });

  it("admin header exposes a visible Sign out control", () => {
    const header = read("src/app/admin/admin-header.tsx");
    assert.match(header, /AdminSignOutButton/);
    assert.match(header, /JobProof Admin/);
    assert.match(header, /sticky/);
  });

  it("Sign out uses Supabase auth.signOut and redirects to /login by default", () => {
    const source = read("src/app/admin/admin-sign-out-button.tsx");
    assert.match(source, /supabase\.auth\.signOut\(\)/);
    assert.match(source, /createClient/);
    assert.match(source, /redirectTo = "\/login"/);
    assert.match(source, /label = "Sign out"/);
    assert.match(source, /type="button"/);
    assert.match(source, /min-h-\[44px\]/);
    assert.doesNotMatch(source, /redirectTo = "\/login\?next=\/admin"/);
  });

  it("NotAuthorized keeps switch-account sign-out to admin login next", () => {
    const source = read("src/app/admin/NotAuthorized.tsx");
    assert.match(source, /ADMIN_LOGIN_PATH/);
    assert.match(source, /Sign out and sign in as admin/);
    assert.match(source, /redirectTo=\{ADMIN_LOGIN_PATH\}/);
  });

  it("admin route protection remains unchanged", () => {
    for (const rel of [
      "src/app/admin/page.tsx",
      "src/app/admin/partners/page.tsx",
      "src/app/admin/waitlist/page.tsx",
      "src/app/admin/analytics/page.tsx",
      "src/app/admin/stripe-readiness/page.tsx",
    ]) {
      const source = read(rel);
      assert.match(source, /requireAdminUserOrRedirectLogin/);
    }
    const auth = read("src/lib/admin-auth.ts");
    assert.match(auth, /redirect\(ADMIN_LOGIN_PATH\)/);
    assert.match(auth, /isAdminEmail/);
  });

  it("contractor and Partner logout controls are unchanged", () => {
    const contractor = read("src/app/(app)/logout-button.tsx");
    assert.match(contractor, /supabase\.auth\.signOut\(\)/);
    assert.match(contractor, /router\.push\("\/"\)/);

    const partnerLayout = read("src/app/(partner)/partner/(portal)/layout.tsx");
    assert.match(partnerLayout, /LogoutButton/);
  });
});
