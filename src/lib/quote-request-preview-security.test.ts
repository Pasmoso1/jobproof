import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuoteRequestForm } from "@/app/quote/[slug]/quote-request-form";
import {
  buildQuoteFormPreviewUrl,
  isQuoteFormPreviewMode,
  QUOTE_FORM_PREVIEW_PARAM,
  QUOTE_FORM_PREVIEW_SUBMIT_LABEL,
  QUOTE_FORM_PREVIEW_VALUE,
} from "@/lib/quote-requests/preview-mode";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("quote-request preview security", () => {
  it("only enables preview for the exact query value preview=1", () => {
    assert.equal(QUOTE_FORM_PREVIEW_PARAM, "preview");
    assert.equal(QUOTE_FORM_PREVIEW_VALUE, "1");
    assert.equal(isQuoteFormPreviewMode({ preview: "1" }), true);
    assert.equal(isQuoteFormPreviewMode(new URLSearchParams("preview=1")), true);
    for (const value of ["true", "yes", "01", "2", ""]) {
      assert.equal(isQuoteFormPreviewMode({ preview: value }), false, value);
    }
    // Whitespace around "1" is trimmed and still counts as preview.
    assert.equal(isQuoteFormPreviewMode({ preview: " 1 " }), true);
    assert.equal(isQuoteFormPreviewMode({}), false);
    assert.equal(isQuoteFormPreviewMode(null), false);
  });

  it("builds preview URLs without rewriting the public quote path", () => {
    assert.equal(
      buildQuoteFormPreviewUrl("https://www.jobproof.ca/quote/green-construction"),
      "https://www.jobproof.ca/quote/green-construction?preview=1"
    );
    assert.equal(
      buildQuoteFormPreviewUrl("https://www.jobproof.ca/quote/green-construction?utm_source=x"),
      "https://www.jobproof.ca/quote/green-construction?utm_source=x&preview=1"
    );
  });

  it("preview UI has no live submit control and no file inputs", () => {
    const preview = renderToStaticMarkup(
      createElement(QuoteRequestForm, {
        slug: "green-construction",
        contractorPhone: "416-555-0100",
        previewMode: true,
      })
    );
    assert.ok(preview.includes(QUOTE_FORM_PREVIEW_SUBMIT_LABEL.replace("'", "&#x27;")));
    assert.doesNotMatch(preview, />Submit quote request</);
    assert.doesNotMatch(preview, /type="file"/);
    assert.doesNotMatch(preview, /type="submit"/);

    const live = renderToStaticMarkup(
      createElement(QuoteRequestForm, {
        slug: "green-construction",
        contractorPhone: "416-555-0100",
        previewMode: false,
      })
    );
    assert.match(live, />Submit quote request</);
    assert.match(live, /type="file"/);
    assert.doesNotMatch(live, /Preview only/);
  });

  it("preview handlers return before any server submit or photo upload action", () => {
    const form = src("src/app/quote/[slug]/quote-request-form.tsx");
    const submitGuard = form.search(
      /if \(previewMode\) \{\s*setError\(QUOTE_FORM_PREVIEW_SUBMIT_LABEL\);\s*return;/
    );
    const liveSubmit = form.indexOf("await submitPublicQuoteRequest(slug,");
    assert.ok(submitGuard >= 0);
    assert.ok(liveSubmit > submitGuard);

    assert.match(form, /if \(previewMode\) return;\s*\n\s*const metaCheck = validateQuotePhotoMeta/);
    assert.match(form, /const addFiles = useCallback\(\s*\(incoming: FileList \| File\[\]\) => \{\s*if \(previewMode\) return;/);
    assert.match(form, /\{previewMode \? null : \(\s*<>[\s\S]*?type="file"/);
  });

  it("does not add a server-side preview bypass to the live submit action", () => {
    const actions = src("src/app/quote/[slug]/actions.ts");
    assert.doesNotMatch(actions, /preview/i);
    assert.match(actions, /export type SubmitPublicQuoteRequestInput = \{[\s\S]*?photoPaths: string\[\];\s*\};/);
    assert.match(actions, /validatePublicQuoteRequestFields\(/);
    assert.match(actions, /sendQuoteRequestReceivedEmail\(/);
    assert.match(actions, /PRODUCT_ANALYTICS_EVENTS\.quote_request_received/);

    // Live path still runs after the same contractor + validation gates as before.
    const submitFn = actions.slice(actions.indexOf("export async function submitPublicQuoteRequest"));
    assert.match(submitFn, /if \(!contractor \|\| !contractor\.quote_ready\)/);
    assert.match(submitFn, /admin\.from\("quote_requests"\)\.insert\(/);
  });

  it("preview mode only gates the UI; the live page still mounts the normal form", () => {
    const page = src("src/app/quote/[slug]/page.tsx");
    assert.match(page, /const previewMode = isQuoteFormPreviewMode\(sp\);/);
    assert.match(
      page,
      /<QuoteRequestForm\s+slug=\{contractor\.quote_slug\}\s+contractorPhone=\{contractor\.phone\}\s+previewMode=\{previewMode\}\s*\/>/
    );
    // Without the query flag, previewMode is false and customers keep the live workflow.
    assert.equal(isQuoteFormPreviewMode({}), false);
  });

  it("welcome Try it yourself opens preview only and does not create requests itself", () => {
    const dashboard = src("src/components/dashboard/first-time-dashboard.tsx");
    assert.match(dashboard, /buildQuoteFormPreviewUrl\(quoteUrl\)/);
    assert.match(dashboard, /target="_blank"/);
    assert.match(dashboard, /rel="noopener noreferrer"/);
    assert.doesNotMatch(dashboard, /submitPublicQuoteRequest|from\("quote_requests"\)\.insert/);
  });
});
