import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PARTNER_PORTAL_FAQS, PARTNER_LANDING_FAQS } from "@/lib/partners/content/faqs";
import { PARTNER_TRAINING_ARTICLES } from "@/lib/partners/content/training";
import {
  PARTNER_PAYMENT_METHOD_LABEL,
  hasPartnerPaymentEmail,
} from "@/lib/partners/payment-details";
import { rewardAmountForPartner } from "@/lib/partners/constants";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("Partner payout UX content", () => {
  it("Training no longer tells partners to explain the 90-day requirement", () => {
    const tips = PARTNER_TRAINING_ARTICLES.find((a) => a.slug === "referral-tips");
    assert.ok(tips);
    assert.doesNotMatch(tips!.body, /Explain the 90 consecutive-day/i);
    assert.match(
      tips!.body,
      /Focus on how JobProof helps contractors win work/i
    );
  });

  it('removes "paid manually" from partner-facing Training and FAQ content', () => {
    for (const article of PARTNER_TRAINING_ARTICLES) {
      assert.doesNotMatch(article.body, /paid manually/i);
    }
    for (const faq of [...PARTNER_PORTAL_FAQS, ...PARTNER_LANDING_FAQS]) {
      assert.doesNotMatch(faq.answer, /paid manually/i);
    }
    assert.match(
      PARTNER_TRAINING_ARTICLES.find((a) => a.slug === "referral-tips")!.body,
      /reviewed and approved by JobProof before payment/i
    );
  });

  it("FAQ identifies Interac e-Transfer for payouts", () => {
    const whenPaid = PARTNER_PORTAL_FAQS.find((f) => f.question === "When do I get paid?");
    assert.ok(whenPaid);
    assert.match(whenPaid!.answer, /Interac e-Transfer/);
    assert.match(whenPaid!.answer, /90 consecutive days/);
    assert.match(whenPaid!.answer, /payment email listed in your Partner account/);
    assert.equal(PARTNER_PAYMENT_METHOD_LABEL, "Interac e-Transfer");
  });
});

describe("Partner payment email field reuse", () => {
  it("reuses existing partners.payment_email without a new migration", () => {
    const migration061 = read("supabase/migrations/061_partner_portal.sql");
    assert.match(migration061, /payment_email text/);
    const files = readdirSync(join(root, "supabase/migrations")).filter(
      (f) => f.endsWith(".sql") && f > "061_partner_portal.sql"
    );
    for (const file of files) {
      const sql = read(`supabase/migrations/${file}`);
      assert.doesNotMatch(
        sql,
        /ADD COLUMN(?: IF NOT EXISTS)?\s+payment_email/i,
        `unexpected payment_email column in ${file}`
      );
    }
  });

  it("payment email can differ from login email and does not touch Auth", () => {
    assert.equal(hasPartnerPaymentEmail(null), false);
    assert.equal(hasPartnerPaymentEmail("payout@example.com"), true);
    const action = read("src/app/(partner)/partner/(portal)/actions.ts");
    assert.match(action, /payment_email: paymentEmail/);
    assert.doesNotMatch(action, /auth\.updateUser|auth\.admin/);
    assert.doesNotMatch(action, /\.update\(\{[^}]*\bemail:/);
    const form = read(
      "src/app/(partner)/partner/(portal)/payments/payment-email-form.tsx"
    );
    assert.match(form, /different from your JobProof login email/);
    assert.match(form, /PARTNER_PAYMENT_METHOD_LABEL/);
  });

  it("missing payment email does not appear in qualification cron/logic", () => {
    const cron = read("src/app/api/cron/partner-rewards/route.ts");
    assert.doesNotMatch(cron, /payment_email/);
    const paymentsPage = read(
      "src/app/(partner)/partner/(portal)/payments/page.tsx"
    );
    assert.match(paymentsPage, /Payment details/);
  });

  it("new partner approvals leave payment_email unset for partner to provide", () => {
    const approve = read("src/lib/partners/approve.ts");
    assert.match(approve, /payment_email:\s*null/);
  });

  it("admin surfaces payment email and warns when missing before mark paid", () => {
    const client = read("src/app/admin/partners/admin-partners-client.tsx");
    assert.match(client, /payment_email/);
    assert.match(client, /Missing payment email/);
    assert.match(client, /hasPartnerPaymentEmail\(r\.partner_payment_email\)/);
    assert.match(client, /PARTNER_PAYMENT_METHOD_LABEL/);
  });
});

describe("Reward amounts unchanged", () => {
  it("Organization reward remains $150; Creator/Marketing Founding/Standard unchanged", () => {
    assert.equal(
      rewardAmountForPartner({
        partner_level: "standard",
        partner_type: "organization",
      }),
      150
    );
    assert.equal(
      rewardAmountForPartner({
        partner_level: "founding",
        partner_type: "organization",
      }),
      150
    );
    assert.equal(
      rewardAmountForPartner({
        partner_level: "founding",
        partner_type: "creator",
      }),
      150
    );
    assert.equal(
      rewardAmountForPartner({
        partner_level: "standard",
        partner_type: "creator",
      }),
      100
    );
    assert.equal(
      rewardAmountForPartner({
        partner_level: "standard",
        partner_type: "marketing",
      }),
      100
    );
  });
});
