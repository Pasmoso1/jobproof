import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const actionsPath = join(here, "../../app/partners/actions.ts");

function transpileActionsModule(): string {
  const source = readFileSync(actionsPath, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      verbatimModuleSyntax: true,
      isolatedModules: true,
    },
    fileName: "actions.ts",
  });
  return result.outputText;
}

describe("partners actions type-erasure safety", () => {
  it("imports PartnerApplyResult with import type only and never re-exports it", () => {
    const source = readFileSync(actionsPath, "utf8");

    assert.match(
      source,
      /import\s+type\s*\{\s*PartnerApplyResult\s*\}\s*from\s*["']@\/lib\/partners\/submit-application["']/
    );
    assert.doesNotMatch(source, /export\s+type\s*\{\s*PartnerApplyResult\b/);
    assert.doesNotMatch(source, /export\s*\{[^}]*\bPartnerApplyResult\b/);
    assert.doesNotMatch(
      source,
      /import\s*\{[^}]*\bPartnerApplyResult\b[^}]*\}\s*from/
    );
  });

  it("transpiled server action module does not reference PartnerApplyResult at runtime", () => {
    const code = transpileActionsModule();

    assert.doesNotMatch(code, /\bPartnerApplyResult\b/);
    assert.match(code, /\bsubmitPartnerApplication\b/);
    assert.match(code, /\bsubmitPartnerApplicationCore\b/);
  });

  it("can evaluate a stripped actions module without PartnerApplyResult runtime binding", () => {
    const code = transpileActionsModule();
    const nodeRequire = createRequire(import.meta.url);
    const moduleBag = { exports: {} as Record<string, unknown> };
    const fakeRequire = (id: string) => {
      if (id.includes("submit-application")) {
        return {
          submitPartnerApplicationCore: async () => ({
            success: false,
            error: "stub",
          }),
          resolvePartnerApplyFlow: () => "new_account",
          logPartnerApplyAuthDiagnostics: () => undefined,
        };
      }
      if (id.includes("product-analytics")) {
        return {
          PRODUCT_ANALYTICS_EVENTS: {
            founding_partner_section_viewed: "founding_partner_section_viewed",
            partner_agreement_viewed: "partner_agreement_viewed",
            partner_application_submitted: "partner_application_submitted",
            partner_agreement_accepted: "partner_agreement_accepted",
          },
          trackProductEventSafe: () => undefined,
        };
      }
      if (id.includes("constants")) {
        return { PARTNER_AGREEMENT_VERSION: "2026-07-01" };
      }
      if (id.includes("emails")) {
        return {
          sendPartnerApplicationReceivedEmail: async () => ({ ok: true }),
        };
      }
      if (id.includes("ops-notifications")) {
        return { sendOpsNotification: async () => ({ ok: true }) };
      }
      if (id.includes("service-role")) {
        return { createServiceRoleClient: () => null };
      }
      if (id.includes("supabase/server")) {
        return {
          createClient: async () => ({
            from: () => ({
              insert: async () => ({ error: null }),
            }),
          }),
        };
      }
      if (id.includes("auth-account")) {
        return {
          checkPartnerUsernameAvailability: async () => ({
            available: true,
            reason: "ok",
          }),
          claimPartnerUsername: async () => ({ ok: true }),
          createPartnerAuthUserViaSignUp: async () => ({
            ok: false,
            error: "stub",
          }),
          deletePartnerAuthUserIfOrphan: async () => undefined,
          linkRegistryApplicationId: async () => undefined,
          releasePartnerUsernameClaim: async () => undefined,
        };
      }
      if (id.includes("partners/username")) {
        return {
          validatePartnerLoginIdentifier: () => ({
            ok: false,
            error: "stub",
          }),
        };
      }
      return nodeRequire(id);
    };

    // Evaluate as CommonJS with stubs — fails loudly if PartnerApplyResult is a runtime ref.
    const runner = new Function(
      "require",
      "module",
      "exports",
      `${code}\nreturn module.exports;`
    );
    const exported = runner(
      fakeRequire,
      moduleBag,
      moduleBag.exports
    ) as Record<string, unknown>;

    assert.equal("PartnerApplyResult" in exported, false);
    assert.equal(typeof exported.submitPartnerApplication, "function");
    assert.equal(typeof exported.trackPartnerPublicEvent, "function");
  });
});
