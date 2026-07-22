import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("partner username auth security invariants", () => {
  it("migration never stores password columns on partner tables", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/063_partner_username_auth.sql"),
      "utf8"
    );
    assert.doesNotMatch(sql, /\bpassword\b(?!s remain|s or hashes|s are never)/i);
    assert.doesNotMatch(sql, /ADD COLUMN[^;]*password/i);
    assert.match(sql, /partner_username_registry/);
    assert.match(sql, /auth_user_id/);
    assert.match(sql, /normalized_username/);
  });

  it("credential actions do not return resolved emails", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/auth/credential-actions.ts"),
      "utf8"
    );
    assert.match(source, /signInWithUsernameOrEmail/);
    assert.match(source, /requestPasswordResetForUsernameOrEmail/);
    assert.doesNotMatch(source, /return \{[^}]*email:/);
    assert.match(source, /GENERIC_LOGIN_ERROR/);
    assert.match(source, /GENERIC_RESET_MESSAGE/);
  });

  it("username availability action does not expose emails", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/partners/actions.ts"),
      "utf8"
    );
    assert.match(source, /checkPartnerUsernameAvailableAction/);
    assert.doesNotMatch(
      source,
      /checkPartnerUsernameAvailableAction[\s\S]{0,400}email:/
    );
  });

  it("partner portal layout gates on active partner via status redirect", () => {
    const portalLayout = readFileSync(
      join(
        process.cwd(),
        "src/app/(partner)/partner/(portal)/layout.tsx"
      ),
      "utf8"
    );
    assert.match(portalLayout, /getActivePartnerForCurrentUser/);
    assert.match(portalLayout, /\/partner\/status/);
  });

  it("approval email mentions credentials chosen at apply, never includes a password value", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/partners/emails.ts"),
      "utf8"
    );
    assert.match(source, /password you chose during your application/i);
    assert.match(source, /forgot-password/);
    assert.doesNotMatch(source, /Your password is/i);
  });

  it("session prefers auth_user_id over email matching", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/partners/session.ts"),
      "utf8"
    );
    assert.match(source, /auth_user_id/);
    assert.match(source, /getPartnerAccountStatusForCurrentUser/);
    assert.match(source, /emailVerified/);
  });

  it("availability action treats emails as available without registry lookup", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/partners/auth-account.ts"),
      "utf8"
    );
    assert.match(source, /looksLikeEmail/);
    assert.match(source, /reason: "email"/);
  });

  it("apply page always renders password fields for guests", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/partners/apply/page.tsx"),
      "utf8"
    );
    assert.match(source, /Username or Email/);
    assert.match(source, /Confirm Password/);
    assert.match(source, /passwordRequired/);
    assert.match(source, /Show/);
    assert.match(source, /Hide/);
    // Guests see passwords unless auth check confirms a signed-in session.
    assert.match(source, /authChecked \? !signedInEmail : true/);
  });
});
