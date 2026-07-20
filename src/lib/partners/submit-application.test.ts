import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PARTNER_AGREEMENT_VERSION } from "@/lib/partners/constants";
import {
  buildPartnerApplicationInsertRow,
  insertPartnerApplicationWithoutSelect,
  mapPartnerApplicationInsertError,
  parsePartnerApplicationFormData,
  submitPartnerApplicationCore,
  type PartnerApplicationInsertClient,
} from "@/lib/partners/submit-application";

function validFormData(overrides?: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("organization_name", "Acme Partners");
  fd.set("contact_name", "Jordan Lee");
  fd.set("email", "jordan@example.com");
  fd.set("phone", "");
  fd.set("website", "");
  fd.set("partner_type", "influencer");
  fd.set("estimated_audience", "");
  fd.set("promotion_plan", "Share with my contractor network.");
  fd.set("reason", "I work with many independent contractors.");
  fd.set("agreement_accepted", "on");
  for (const [key, value] of Object.entries(overrides ?? {})) {
    fd.set(key, value);
  }
  return fd;
}

function createInsertClient(options?: {
  error?: { code?: string; message?: string; details?: string; hint?: string } | null;
  onInsert?: (row: Record<string, unknown>) => void;
  /** If true, calling .select after insert throws — proves we must not use it. */
  rejectSelect?: boolean;
}): PartnerApplicationInsertClient & {
  lastRow: Record<string, unknown> | null;
  selectCalled: boolean;
} {
  const state = {
    lastRow: null as Record<string, unknown> | null,
    selectCalled: false,
  };

  const client: PartnerApplicationInsertClient & typeof state = {
    ...state,
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        state.lastRow = row;
        client.lastRow = row;
        options?.onInsert?.(row);
        const result = {
          error: options?.error ?? null,
          select: () => {
            state.selectCalled = true;
            client.selectCalled = true;
            if (options?.rejectSelect) {
              throw new Error("SELECT is not permitted for anonymous insert");
            }
            return {
              maybeSingle: async () => ({
                data: null,
                error: {
                  code: "42501",
                  message: "permission denied for table partner_applications",
                },
              }),
            };
          },
        };
        return result;
      },
    }),
  };

  return client;
}

describe("submitPartnerApplicationCore", () => {
  it("successfully inserts an anonymous application without SELECT", async () => {
    const client = createInsertClient({ rejectSelect: true });
    const now = new Date("2026-07-20T14:00:00.000Z");

    const result = await submitPartnerApplicationCore({
      formData: validFormData(),
      insertClient: client,
      now,
    });

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.ok(result.applicationId);
    assert.equal(client.selectCalled, false);
    assert.ok(client.lastRow);
    assert.equal(client.lastRow?.partner_type, "influencer");
    assert.equal(client.lastRow?.agreement_version, PARTNER_AGREEMENT_VERSION);
    assert.equal(client.lastRow?.agreement_accepted_at, now.toISOString());
    assert.equal(client.lastRow?.phone, null);
    assert.equal(client.lastRow?.website, null);
    assert.equal(client.lastRow?.estimated_audience, null);
    assert.equal(client.lastRow?.status, "submitted");
    assert.equal(client.lastRow?.id, result.applicationId);
  });

  it("succeeds when the insert client has no SELECT permission", async () => {
    const client = createInsertClient({ rejectSelect: true });
    const result = await submitPartnerApplicationCore({
      formData: validFormData({ partner_type: "influencer" }),
      insertClient: client,
    });
    assert.equal(result.success, true);
    assert.equal(client.selectCalled, false);
  });

  it("rejects an invalid partner type", async () => {
    const client = createInsertClient();
    const result = await submitPartnerApplicationCore({
      formData: validFormData({ partner_type: "not_a_real_type" }),
      insertClient: client,
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.equal(result.fieldErrors?.partner_type, "Select a partner type.");
    assert.equal(client.lastRow, null);
  });

  it("rejects missing agreement acceptance", async () => {
    const fd = validFormData();
    fd.delete("agreement_accepted");
    const client = createInsertClient();
    const result = await submitPartnerApplicationCore({
      formData: fd,
      insertClient: client,
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.match(result.error, /Partner Program Agreement/);
    assert.ok(result.fieldErrors?.agreement_accepted);
    assert.equal(client.lastRow, null);
  });

  it("maps temporary database failures to a safe user message", async () => {
    const logs: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      logs.push(args);
    };
    try {
      const client = createInsertClient({
        error: {
          code: "57014",
          message: "canceling statement due to statement timeout",
          details: "internal",
          hint: "retry",
        },
      });
      const result = await submitPartnerApplicationCore({
        formData: validFormData(),
        insertClient: client,
      });
      assert.equal(result.success, false);
      if (result.success) return;
      assert.match(result.error, /temporary database problem/i);
      assert.ok(logs.length > 0);
      const payload = (logs[0] as unknown[])[1] as Record<string, unknown>;
      assert.equal(payload.code, "57014");
      assert.equal(payload.message, "canceling statement due to statement timeout");
      assert.equal(payload.details, "internal");
      assert.equal(payload.hint, "retry");
      assert.equal("email" in payload, false);
      assert.equal("organization_name" in payload, false);
    } finally {
      console.error = originalError;
    }
  });

  it("maps duplicate key failures to a safe user message", async () => {
    const client = createInsertClient({
      error: { code: "23505", message: "duplicate key value" },
    });
    const result = await submitPartnerApplicationCore({
      formData: validFormData(),
      insertClient: client,
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.match(result.error, /already on file/i);
  });

  it("returns duplicate message from secure open-application lookup", async () => {
    const client = createInsertClient();
    const result = await submitPartnerApplicationCore({
      formData: validFormData(),
      insertClient: client,
      findOpenApplicationIdByEmail: async () => "existing-id",
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.match(result.error, /already under review/i);
    assert.equal(client.lastRow, null);
  });
});

describe("insertPartnerApplicationWithoutSelect", () => {
  it("does not call select after insert", async () => {
    const client = createInsertClient({ rejectSelect: true });
    const row = buildPartnerApplicationInsertRow(
      parsePartnerApplicationFormData(validFormData()),
      { applicationId: "11111111-1111-4111-8111-111111111111" }
    );
    const result = await insertPartnerApplicationWithoutSelect(client, row);
    assert.equal(result.ok, true);
    assert.equal(client.selectCalled, false);
  });
});

describe("mapPartnerApplicationInsertError", () => {
  it("classifies invalid data codes", () => {
    const result = mapPartnerApplicationInsertError({ code: "23514" });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.match(result.error, /invalid/i);
  });
});

describe("parsePartnerApplicationFormData", () => {
  it("converts blank optional fields to null", () => {
    const parsed = parsePartnerApplicationFormData(
      validFormData({
        phone: "   ",
        website: "",
        estimated_audience: "  ",
      })
    );
    assert.equal(parsed.phone, null);
    assert.equal(parsed.website, null);
    assert.equal(parsed.estimatedAudience, null);
    assert.equal(parsed.partnerType, "influencer");
    assert.equal(parsed.agreementAccepted, true);
  });
});
