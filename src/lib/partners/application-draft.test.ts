import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  PARTNER_APPLICATION_DRAFT_KEY,
  PARTNER_APPLY_LOGIN_NEXT,
  clearPartnerApplicationDraft,
  collectPartnerApplicationDraftFields,
  draftHasSensitiveData,
  loadPartnerApplicationDraft,
  markPartnerApplicationDraftRestored,
  partnerApplyLoginHref,
  savePartnerApplicationDraft,
} from "@/lib/partners/application-draft";

describe("partner application draft", () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    (globalThis as { sessionStorage?: Storage }).sessionStorage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
      key: () => null,
      length: 0,
    };
  });

  afterEach(() => {
    clearPartnerApplicationDraft();
  });

  it("saves non-sensitive Creator fields and strips passwords", () => {
    const fd = new FormData();
    fd.set("partner_type", "creator");
    fd.set("organization_name", "Site Videos");
    fd.set("contact_name", "Alex");
    fd.set("email", "alex@example.com");
    fd.set("website", "instagram.com/alex");
    fd.set("primary_platform", "instagram");
    fd.set("additional_links", "youtube.com/@alex");
    fd.set("estimated_audience", "8000");
    fd.set("reason", "Jobsite videos");
    fd.set("password", "secret12");
    fd.set("confirm_password", "secret12");
    fd.set("agreement_accepted", "on");

    const fields = collectPartnerApplicationDraftFields(fd);
    assert.equal(fields.password, undefined);
    assert.equal(fields.confirm_password, undefined);
    assert.equal(fields.agreement_accepted, undefined);
    assert.equal(fields.partner_type, "creator");
    assert.equal(fields.website, "instagram.com/alex");
    assert.equal(fields.additional_links, "youtube.com/@alex");

    const draft = savePartnerApplicationDraft({
      fields,
      returnPath: PARTNER_APPLY_LOGIN_NEXT,
      pendingRestore: true,
    });
    assert.equal(draft.pendingRestore, true);
    assert.equal(draftHasSensitiveData(draft), false);
    assert.ok(memory.has(PARTNER_APPLICATION_DRAFT_KEY));

    const loaded = loadPartnerApplicationDraft();
    assert.ok(loaded);
    assert.equal(loaded!.fields.organization_name, "Site Videos");
    assert.equal(loaded!.fields.password, undefined);
    assert.equal(loaded!.returnPath, PARTNER_APPLY_LOGIN_NEXT);
  });

  it("marks restore complete and clears after success", () => {
    savePartnerApplicationDraft({
      fields: { partner_type: "marketing", reason: "Paid media" },
      returnPath: PARTNER_APPLY_LOGIN_NEXT,
      pendingRestore: true,
    });
    markPartnerApplicationDraftRestored();
    const mid = loadPartnerApplicationDraft();
    assert.equal(mid?.pendingRestore, false);

    clearPartnerApplicationDraft();
    assert.equal(loadPartnerApplicationDraft(), null);
  });

  it("builds a login redirect that returns to apply without query field data", () => {
    const href = partnerApplyLoginHref(PARTNER_APPLY_LOGIN_NEXT);
    assert.equal(href, "/login?next=%2Fpartners%2Fapply");
    assert.doesNotMatch(href, /email=/);
    assert.doesNotMatch(href, /password=/);
    assert.doesNotMatch(href, /instagram/);
  });
});
