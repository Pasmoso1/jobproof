import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  QUOTE_REQUEST_STATUSES_AWAITING_RESPONSE,
  markQuoteRequestConvertedAfterQuoteAccepted,
  markQuoteRequestRespondedAfterQuoteSent,
  quoteRequestStatusAfterQuoteAccepted,
  quoteRequestStatusAfterQuoteSent,
} from "@/lib/quote-requests/request-lifecycle";
import { QUOTE_REQUEST_STATUSES, quoteRequestListBucket } from "@/lib/quote-requests/constants";
import { isQuoteRequestOverdue } from "@/lib/quote-requests/response-alerts";
import {
  buildQuoteRequestReceipts,
  parseSubmittedPhotoCount,
} from "@/lib/quote-requests/success-confirmation";
import { resolveQuoteRequestShareContext } from "@/lib/quote-requests/share-context";
import {
  QUOTE_REQUEST_SHARE_EVENTS,
  QUOTE_REQUEST_SHARE_SOURCES,
  trackQuoteRequestShare,
} from "@/lib/quote-request-share-analytics";
import { CONTRACTOR_CONVERSION_FUNNEL, GA4_FUNNEL_EVENTS } from "@/lib/ga4";
import { buildQuoteLinkMessage, buildSmsHref } from "@/lib/quote-link-share";
import {
  SendQuoteRequestButton,
  copyText,
  shareQuoteLink,
} from "@/components/send-quote-request";
import { GetMoreWorkCard } from "@/components/dashboard/get-more-work-card";

function src(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const ORIGIN = "https://www.jobproof.ca";
const QUOTE_URL = `${ORIGIN}/quote/green-construction-2`;
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const CONTRACTOR_ID = "22222222-2222-4222-8222-222222222222";

type Call = { method: string; args: unknown[] };

/** Records the PostgREST chain and returns `rows` from the final select. */
function fakeClient(rows: unknown[] = [{ id: REQUEST_ID }], error: unknown = null) {
  const calls: Call[] = [];
  const chain = {
    update(...args: unknown[]) {
      calls.push({ method: "update", args });
      return chain;
    },
    eq(...args: unknown[]) {
      calls.push({ method: "eq", args });
      return chain;
    },
    in(...args: unknown[]) {
      calls.push({ method: "in", args });
      return chain;
    },
    select(...args: unknown[]) {
      calls.push({ method: "select", args });
      return Promise.resolve({ data: error ? null : rows, error });
    },
  };
  return {
    calls,
    client: {
      from(table: string) {
        calls.push({ method: "from", args: [table] });
        return chain;
      },
    },
  };
}

describe("1. sending a quote clears Needs Response", () => {
  it("moves every awaiting status to responded", () => {
    for (const status of ["new", "reviewed", "site_visit_requested"] as const) {
      assert.equal(quoteRequestStatusAfterQuoteSent(status), "responded");
    }
  });

  it("never downgrades responded, converted or closed", () => {
    assert.equal(quoteRequestStatusAfterQuoteSent("responded"), "responded");
    assert.equal(quoteRequestStatusAfterQuoteSent("converted"), "converted");
    assert.equal(quoteRequestStatusAfterQuoteSent("closed"), "closed");
  });

  it("updates only the contractor's own request, and only from awaiting statuses", async () => {
    const { client, calls } = fakeClient();
    const changed = await markQuoteRequestRespondedAfterQuoteSent(client, {
      quoteRequestId: REQUEST_ID,
      contractorId: CONTRACTOR_ID,
    });
    assert.equal(changed, true);
    assert.deepEqual(calls, [
      { method: "from", args: ["quote_requests"] },
      { method: "update", args: [{ status: "responded" }] },
      { method: "eq", args: ["id", REQUEST_ID] },
      { method: "eq", args: ["contractor_id", CONTRACTOR_ID] },
      { method: "in", args: ["status", ["new", "reviewed", "site_visit_requested"]] },
      { method: "select", args: ["id"] },
    ]);
  });

  it("is a safe no-op when nothing matches or ids are missing", async () => {
    const none = fakeClient([]);
    assert.equal(
      await markQuoteRequestRespondedAfterQuoteSent(none.client, {
        quoteRequestId: REQUEST_ID,
        contractorId: CONTRACTOR_ID,
      }),
      false
    );
    const empty = fakeClient();
    assert.equal(
      await markQuoteRequestRespondedAfterQuoteSent(empty.client, {
        quoteRequestId: " ",
        contractorId: CONTRACTOR_ID,
      }),
      false
    );
    assert.equal(empty.calls.length, 0);
  });

  it("does not throw on database errors", async () => {
    const original = console.error;
    console.error = () => {};
    try {
      const failing = fakeClient([], { message: "boom" });
      assert.equal(
        await markQuoteRequestRespondedAfterQuoteSent(failing.client, {
          quoteRequestId: REQUEST_ID,
          contractorId: CONTRACTOR_ID,
        }),
        false
      );
    } finally {
      console.error = original;
    }
  });

  it("is wired into sendEstimate, which every quote-send path uses", () => {
    const estimateActions = src("src/app/(app)/estimates/estimate-actions.ts");
    const sendBody = estimateActions.slice(
      estimateActions.indexOf("export async function sendEstimate("),
      estimateActions.indexOf("export async function resendEstimateEmail(")
    );
    const sentIdx = sendBody.indexOf('.update({ status: "sent", sent_at: sentAt })');
    const markIdx = sendBody.indexOf("markQuoteRequestRespondedAfterQuoteSent(supabase, {");
    assert.ok(sentIdx > 0 && markIdx > sentIdx, "marks responded only after the email was sent");
    assert.match(sendBody, /String\(est2\.quote_request_id \?\? ""\)\.trim\(\)/);
    assert.match(sendBody, /revalidatePath\("\/quote-requests"\)/);

    const builder = src("src/app/(app)/quote-requests/[requestId]/builder-actions.ts");
    assert.match(builder, /const sendResult = await sendEstimate\(estimateId\);/);
  });
});

describe("2. a responded request cannot become Overdue", () => {
  const dayOld = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  it("only new requests are overdue", () => {
    assert.equal(isQuoteRequestOverdue("new", dayOld), true);
    for (const status of QUOTE_REQUEST_STATUSES.filter((s) => s !== "new")) {
      assert.equal(isQuoteRequestOverdue(status, dayOld), false, status);
    }
  });

  it("an old request that had a quote sent is no longer overdue or in the New list", () => {
    const after = quoteRequestStatusAfterQuoteSent("new");
    assert.equal(isQuoteRequestOverdue(after, dayOld), false);
    assert.equal(quoteRequestListBucket(after), "responded");
  });

  it("badges, banners and alert counts all key off status = new", () => {
    const response = src("src/components/quote-request-response.tsx");
    assert.equal((response.match(/status !== "new"/g) ?? []).length, 3);
    const alerts = src("src/lib/quote-requests/response-alerts.ts");
    assert.match(alerts, /\.eq\("status", "new"\)/);
  });
});

describe("3. accepted quotes convert the request", () => {
  it("converted is the customer-decision success state used by quote progress", () => {
    const progress = src("src/lib/quote-requests/quote-progress.ts");
    assert.match(progress, /if \(status === "converted"\) return "success";/);
  });

  it("open requests convert; closed requests are never reopened", () => {
    for (const status of ["new", "reviewed", "site_visit_requested", "responded"] as const) {
      assert.equal(quoteRequestStatusAfterQuoteAccepted(status), "converted");
    }
    assert.equal(quoteRequestStatusAfterQuoteAccepted("closed"), "closed");
    assert.equal(quoteRequestStatusAfterQuoteAccepted("converted"), "converted");
  });

  it("filters the update to open statuses", async () => {
    const { client, calls } = fakeClient();
    await markQuoteRequestConvertedAfterQuoteAccepted(client, {
      quoteRequestId: REQUEST_ID,
      contractorId: CONTRACTOR_ID,
    });
    assert.deepEqual(calls[1], { method: "update", args: [{ status: "converted" }] });
    assert.deepEqual(calls[4], {
      method: "in",
      args: ["status", [...QUOTE_REQUEST_STATUSES_AWAITING_RESPONSE, "responded"]],
    });
  });

  it("is wired into public quote acceptance", () => {
    const pub = src("src/lib/estimate-public.ts");
    const acceptBody = pub.slice(
      pub.indexOf("export async function acceptPublicEstimateByToken("),
      pub.indexOf("export async function declinePublicEstimateByToken(")
    );
    assert.match(acceptBody, /markQuoteRequestConvertedAfterQuoteAccepted\(admin, \{/);
  });

  it("backfill migration matches the application lifecycle", () => {
    const sql = src("supabase/migrations/069_quote_request_status_after_quote.sql");
    assert.match(sql, /SET status = 'responded'\s+WHERE qr\.status IN \('new', 'reviewed', 'site_visit_requested'\)/);
    assert.match(sql, /SET status = 'converted'\s+WHERE qr\.status IN \('new', 'reviewed', 'site_visit_requested', 'responded'\)/);
    assert.doesNotMatch(sql, /ALTER TABLE|DROP|CREATE/i);
  });
});

describe("4. success page only claims photos that were received", () => {
  it("omits the photo line when no photos were submitted", () => {
    const receipts = buildQuoteRequestReceipts(0);
    assert.deepEqual(receipts, ["Project details received.", "Contact information received."]);
    assert.ok(!receipts.some((r) => /photo/i.test(r)));
  });

  it("confirms photos when at least one was saved", () => {
    assert.equal(buildQuoteRequestReceipts(1)[0], "Photo received.");
    assert.equal(buildQuoteRequestReceipts(4)[0], "Photos received.");
  });

  it("treats a missing or tampered count as no photos", () => {
    assert.equal(parseSubmittedPhotoCount(undefined), 0);
    assert.equal(parseSubmittedPhotoCount(""), 0);
    assert.equal(parseSubmittedPhotoCount("abc"), 0);
    assert.equal(parseSubmittedPhotoCount("-2"), 0);
    assert.equal(parseSubmittedPhotoCount("3"), 3);
    assert.equal(parseSubmittedPhotoCount(["2", "9"]), 2);
  });

  it("the submit action passes the saved photo count and the page uses it", () => {
    const actions = src("src/app/quote/[slug]/actions.ts");
    assert.match(actions, /&\$\{SUBMITTED_PHOTOS_PARAM\}=\$\{photoCount\}/);
    const page = src("src/app/quote/[slug]/success/page.tsx");
    assert.match(page, /buildQuoteRequestReceipts\(parseSubmittedPhotoCount\(photos\)\)/);
    assert.doesNotMatch(page, /Photos received\./);
  });
});

describe("5. share context uses the contractor's quote-request URL", () => {
  const profile = {
    business_name: "Green Construction",
    phone: "416-555-0123",
    address_line_1: "1 Main St",
    city: "Toronto",
    province: "ON",
    postal_code: "M5V 2T6",
    quote_primary_trade: "Renovator",
    quote_slug: "green-construction-2",
  };

  it("returns the public URL and business name when ready", () => {
    assert.deepEqual(resolveQuoteRequestShareContext(profile, "a@b.ca", ORIGIN), {
      quoteUrl: QUOTE_URL,
      businessName: "Green Construction",
    });
  });

  it("returns null before the profile is ready or without a slug", () => {
    assert.equal(resolveQuoteRequestShareContext({ ...profile, quote_slug: null }, "a@b.ca", ORIGIN), null);
    assert.equal(resolveQuoteRequestShareContext({ ...profile, phone: "" }, "a@b.ca", ORIGIN), null);
    assert.equal(resolveQuoteRequestShareContext(null, "a@b.ca", ORIGIN), null);
  });

  it("SMS message uses that URL and falls back without a business name", () => {
    const named = buildQuoteLinkMessage({ businessName: "Green Construction", quoteUrl: QUOTE_URL });
    assert.ok(named.startsWith("Thanks for contacting Green Construction!\n\n"));
    assert.ok(named.endsWith(`\n\n${QUOTE_URL}`));
    const unnamed = buildQuoteLinkMessage({ businessName: null, quoteUrl: QUOTE_URL });
    assert.ok(unnamed.startsWith("Thanks for getting in touch!\n\n"));
    const href = buildSmsHref("+14165550123", named);
    assert.equal(decodeURIComponent(href.split("?body=")[1]!), named);
  });
});

type NavigatorMock = {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

function setNavigator(value: NavigatorMock | undefined) {
  Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
}

describe("6. copy and native share use the quote URL", () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  afterEach(() => {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  });

  it("copyText writes exactly the given URL", async () => {
    const copied: string[] = [];
    setNavigator({ clipboard: { writeText: async (t) => void copied.push(t) } });
    assert.equal(await copyText(QUOTE_URL), true);
    assert.deepEqual(copied, [QUOTE_URL]);
  });

  it("native share receives the quote URL and the message intro", async () => {
    const shared: Array<{ title?: string; text?: string; url?: string }> = [];
    setNavigator({ share: async (data) => void shared.push(data) });
    assert.equal(await shareQuoteLink(QUOTE_URL, "Green Construction"), "shared");
    assert.equal(shared[0]?.url, QUOTE_URL);
    assert.equal(shared[0]?.title, "Request a quote");
    assert.match(shared[0]?.text ?? "", /^Thanks for contacting Green Construction!/);
  });

  it("cancelling the share sheet does not fall back to copying", async () => {
    const copied: string[] = [];
    setNavigator({
      share: async () => {
        throw new DOMException("cancelled", "AbortError");
      },
      clipboard: { writeText: async (t) => void copied.push(t) },
    });
    assert.equal(await shareQuoteLink(QUOTE_URL, null), "cancelled");
    assert.equal(copied.length, 0);
  });

  it("copies the URL when the device has no share sheet", async () => {
    const copied: string[] = [];
    setNavigator({ clipboard: { writeText: async (t) => void copied.push(t) } });
    assert.equal(await shareQuoteLink(QUOTE_URL, null), "copied");
    assert.deepEqual(copied, [QUOTE_URL]);
  });
});

describe("7. analytics events carry no PII and stay out of Meta and the funnel", () => {
  let gtagCalls: unknown[][] = [];
  let fbqCalls: unknown[][] = [];

  beforeEach(() => {
    gtagCalls = [];
    fbqCalls = [];
    (globalThis as { window?: unknown }).window = {
      gtag: (...args: unknown[]) => void gtagCalls.push(args),
      fbq: (...args: unknown[]) => void fbqCalls.push(args),
    };
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("uses the agreed event names", () => {
    assert.deepEqual(Object.values(QUOTE_REQUEST_SHARE_EVENTS).sort(), [
      "quote_request_link_copied",
      "quote_request_native_share_clicked",
      "quote_request_qr_opened",
      "quote_request_share_opened",
      "quote_request_text_clicked",
    ]);
    assert.deepEqual([...QUOTE_REQUEST_SHARE_SOURCES], [
      "dashboard",
      "quote_requests",
      "mobile_global_action",
      "settings",
      "other",
    ]);
  });

  it("sends only enum context to GA4 and nothing to the Meta Pixel", () => {
    for (const eventName of Object.values(QUOTE_REQUEST_SHARE_EVENTS)) {
      for (const source of QUOTE_REQUEST_SHARE_SOURCES) {
        trackQuoteRequestShare(eventName, source, { copy_target: "message", share_method: "native" });
      }
    }
    assert.equal(fbqCalls.length, 0);
    assert.equal(gtagCalls.length, 25);
    for (const [kind, , params] of gtagCalls) {
      assert.equal(kind, "event");
      const keys = Object.keys(params as Record<string, unknown>);
      for (const key of keys) {
        assert.ok(["source_location", "copy_target", "share_method"].includes(key), key);
      }
      const serialized = JSON.stringify(params);
      assert.doesNotMatch(serialized, /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|@|https?:/);
    }
  });

  it("omits optional details that weren't provided", () => {
    trackQuoteRequestShare(QUOTE_REQUEST_SHARE_EVENTS.qr_opened, "quote_requests");
    assert.deepEqual(gtagCalls[0], [
      "event",
      "quote_request_qr_opened",
      { source_location: "quote_requests" },
    ]);
  });

  it("does not add events to the acquisition funnel", () => {
    const funnelNames: string[] = Object.values(GA4_FUNNEL_EVENTS);
    const funnelStages: string[] = CONTRACTOR_CONVERSION_FUNNEL.map((s) => s.event);
    for (const eventName of Object.values(QUOTE_REQUEST_SHARE_EVENTS)) {
      assert.equal(funnelNames.includes(eventName), false);
      assert.equal(funnelStages.includes(eventName), false);
    }
    assert.match(src("src/lib/quote-request-share-analytics.ts"), /trackGa4Event/);
    assert.doesNotMatch(src("src/lib/quote-request-share-analytics.ts"), /fbq|meta-pixel|trackMeta/i);
  });
});

describe("8. Send Quote Request placements", () => {
  it("renders an accessible trigger and dialog with an empty phone field", () => {
    const html = renderToStaticMarkup(
      createElement(SendQuoteRequestButton, {
        quoteUrl: QUOTE_URL,
        businessName: "Green Construction",
        sourceLocation: "quote_requests",
      })
    );
    assert.match(html, /aria-haspopup="dialog"/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, />Send Quote Request<\/button>/);
    assert.match(html, /<dialog[^>]*aria-labelledby=/);
    assert.match(html, /aria-label="Close Send Quote Request"/);
    assert.match(html, /Send your customer a link so they can tell you about the job and add photos/);
    assert.match(html, /<input[^>]*type="tel"[^>]*value=""/);
    assert.match(html, /Other ways to share/);
    for (const label of ["Send by Text", "Copy Link", ">Share<", "QR Code"]) {
      assert.ok(html.includes(label), label);
    }
    assert.ok(!html.includes("Customer name"), "no name field: speed over personalization");
    assert.ok(!html.includes('type="email"'));
  });

  it("dashboard card still offers text, copy, share and QR", () => {
    const html = renderToStaticMarkup(
      createElement(GetMoreWorkCard, {
        quoteUrl: QUOTE_URL,
        businessName: "Green Construction",
        variant: "compact",
        profileReady: true,
      })
    );
    for (const label of ["Get more work", "Send Quote Request", "Send by Text", "Copy Link", ">Share<", "QR Code"]) {
      assert.ok(html.includes(label), label);
    }
  });

  it("is reachable from the mobile header, Quote Requests and settings", () => {
    const layout = src("src/app/(app)/layout.tsx");
    assert.match(layout, /resolveQuoteRequestShareContext\(profile, user\.email \?\? "", resolveAppUrl\(\)\)/);
    assert.match(layout, /quote_slug/);
    const quoteRequests = src("src/app/(app)/quote-requests/page.tsx");
    assert.match(quoteRequests, /<SendQuoteRequestButton[\s\S]*?sourceLocation="quote_requests"/);
    const settings = src("src/app/(app)/settings/quote-requests/quote-request-settings-form.tsx");
    assert.match(settings, /QUOTE_LINK_WEBSITE_GUIDANCE/);
    assert.match(settings, /Copy Quote Request Link/);
    assert.match(settings, /trackQuoteRequestShare\(QUOTE_REQUEST_SHARE_EVENTS\.link_copied, "settings"/);
  });

  it("the sheet handles keyboard, safe areas and dismissal", () => {
    const share = src("src/components/send-quote-request.tsx");
    assert.match(share, /window\.visualViewport/);
    assert.match(share, /env\(safe-area-inset-bottom\)/);
    assert.match(share, /dialog\.showModal\(\);\s*\/\/[^\n]*\n\s*phoneInputRef\.current\?\.focus\(\);/);
    assert.match(share, /triggerRef\.current\?\.focus\(\)/);
    assert.match(share, /if \(e\.target === e\.currentTarget\) closeSheet\(\);/);
    assert.match(share, /setSession\(\(n\) => n \+ 1\)/, "phone number is forgotten when the sheet closes");
    assert.match(
      share,
      /function handleDialogClose\([^)]*\) \{[\s\S]*?if \(event\.target !== event\.currentTarget\) return;[\s\S]*?setOpen\(false\);/,
      "closing the nested QR dialog must not reset the open sheet"
    );
  });
});

describe("9. partner and referral behaviour is unchanged", () => {
  it("share code never reads or writes partner attribution", () => {
    for (const file of [
      "src/components/send-quote-request.tsx",
      "src/lib/quote-request-share-analytics.ts",
      "src/lib/quote-requests/share-context.ts",
      "src/lib/quote-requests/request-lifecycle.ts",
    ]) {
      assert.doesNotMatch(src(file), /partner|referral|jp_partner_ref|first_touch/i, file);
    }
  });

  it("the quote URL carries no referral or tracking parameters", () => {
    const url = new URL(QUOTE_URL);
    assert.equal(url.search, "");
  });

  it("root layout still captures partner refs", () => {
    assert.match(src("src/app/layout.tsx"), /PartnerRefCapture/);
  });
});
