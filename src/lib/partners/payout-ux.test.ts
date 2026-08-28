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
import {
  adminRewardStatusLabel,
  partnerFacingRewardStatusLabel,
  rewardAmountForPartner,
  rewardStatusLabel,
} from "@/lib/partners/constants";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const PARTNER_FACING_COPY_FILES = [
  "src/lib/partners/content/training.ts",
  "src/lib/partners/content/faqs.ts",
  "src/lib/partners/emails.ts",
  "src/lib/partners/media-center-content.ts",
  "src/app/partners/page.tsx",
  "src/app/(partner)/partner/(portal)/page.tsx",
  "src/app/(partner)/partner/(portal)/payments/page.tsx",
  "src/app/(partner)/partner/(portal)/referrals/page.tsx",
];

const PAYOUT_REVIEW_PHRASES = [
  /reviewed and approved by JobProof before payment/i,
  /rewards are reviewed and approved/i,
  /JobProof review and approval/i,
  /awaiting JobProof review/i,
  /once the referral qualifies and is approved/i,
  /paid manually/i,
  /payouts are reviewed manually/i,
  /Approved \(awaiting payout\)/i,
  /Approved reward/i,
];

describe("Partner payout copy — no discretionary approval messaging", () => {
  it("partner-facing sources omit reward review/approval payout wording", () => {
    for (const rel of PARTNER_FACING_COPY_FILES) {
      const source = read(rel);
      for (const pattern of PAYOUT_REVIEW_PHRASES) {
        assert.doesNotMatch(
          source,
          pattern,
          `${rel} should not match ${pattern}`
        );
      }
    }
  });

  it("FAQ does not say once the referral qualifies and is approved", () => {
    const whenPaid = PARTNER_PORTAL_FAQS.find((f) => f.question === "When do I get paid?");
    assert.ok(whenPaid);
    assert.doesNotMatch(whenPaid!.answer, /once the referral qualifies and is approved/i);
    assert.match(whenPaid!.answer, /Once the referral qualifies, your reward will be sent by Interac e-Transfer/i);
    assert.match(whenPaid!.answer, /90 consecutive days/);
  });

  it("landing FAQ uses qualification + Interac wording without reward approval step", () => {
    const whenPaid = PARTNER_LANDING_FAQS.find((f) => f.question === "When do I get paid?");
    assert.ok(whenPaid);
    assert.doesNotMatch(whenPaid!.answer, /and is approved/i);
    assert.match(whenPaid!.answer, /Interac e-Transfer/);
  });

  it("Training does not tell partners rewards are reviewed or approved", () => {
    for (const article of PARTNER_TRAINING_ARTICLES) {
      assert.doesNotMatch(article.body, /reviewed and approved/i);
      assert.doesNotMatch(article.body, /JobProof review and approval/i);
    }
    const tips = PARTNER_TRAINING_ARTICLES.find((a) => a.slug === "referral-tips");
    assert.ok(tips);
    assert.doesNotMatch(tips!.body, /before payment/i);
  });

  it("portal dashboard uses Interac e-Transfer payout wording from screenshot spec", () => {
    const dashboard = read("src/app/(partner)/partner/(portal)/page.tsx");
    assert.match(
      dashboard,
      /Rewards are paid by Interac\s*\n?\s*e-Transfer/
    );
    assert.doesNotMatch(dashboard, /reviewed and approved/i);
  });

  it("referral lifecycle emails avoid post-qualification approval language", () => {
    const emails = read("src/lib/partners/emails.ts");
    assert.doesNotMatch(emails, /awaiting JobProof review/i);
    assert.doesNotMatch(emails, /Referral reward approved/i);
    assert.match(emails, /Interac e-Transfer/);
    assert.match(emails, /application is approved/i);
  });
});

describe("Partner-facing reward status labels", () => {
  it("maps internal approved and needs_review to Qualified for partners", () => {
    assert.equal(partnerFacingRewardStatusLabel("approved"), "Qualified");
    assert.equal(partnerFacingRewardStatusLabel("needs_review"), "Qualified");
    assert.equal(partnerFacingRewardStatusLabel("qualified"), "Qualified");
    assert.equal(partnerFacingRewardStatusLabel("pending"), "Pending qualification");
    assert.equal(partnerFacingRewardStatusLabel("paid"), "Paid");
  });

  it("uses admin Ready for payment label internally for approved", () => {
    assert.equal(adminRewardStatusLabel("approved"), "Ready for payment");
    assert.equal(rewardStatusLabel("approved"), "Ready for payment");
  });

  it("referrals page uses partnerFacingRewardStatusLabel", () => {
    const source = read("src/app/(partner)/partner/(portal)/referrals/page.tsx");
    assert.match(source, /partnerFacingRewardStatusLabel/);
    assert.doesNotMatch(source, /rewardStatusLabel\(/);
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
        /ALTER TABLE\s+partners[\s\S]*ADD COLUMN(?: IF NOT EXISTS)?\s+payment_email/i,
        `unexpected partners.payment_email column in ${file}`
      );
    }
  });

  it("payment email can differ from login email and does not touch Auth", () => {
    assert.equal(hasPartnerPaymentEmail(null), false);
    assert.equal(hasPartnerPaymentEmail("payout@example.com"), true);
    const action = read("src/app/(partner)/partner/(portal)/actions.ts");
    assert.match(action, /payment_email: paymentEmail/);
    assert.match(action, /reverifyPartnerReferralsAfterPaymentEmailUpdate/);
    assert.doesNotMatch(action, /auth\.updateUser|auth\.admin/);
    assert.doesNotMatch(action, /\.update\(\{[^}]*\bemail:/);
  });

  it("missing payment email does not appear in qualification cron/logic", () => {
    const cron = read("src/app/api/cron/partner-rewards/route.ts");
    assert.doesNotMatch(cron, /payment_email/);
  });

  it("admin surfaces payment email and grouped payout workflow", () => {
    const client = read("src/app/admin/partners/admin-partners-client.tsx");
    const adminPage = read("src/app/admin/partners/page.tsx");
    const payoutActions = read("src/app/admin/partners/payout-actions.ts");
    assert.match(client, /payment_email/);
    assert.match(client, /Mark ready for payment/);
    assert.match(client, /Open payout dashboard/);
    assert.match(adminPage, /adminRewardStatusLabel/);
    assert.match(adminPage, /\/admin\/partners\/payouts/);
    assert.match(payoutActions, /record_partner_batch_payout/);
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
        partner_level: "founding",
        partner_type: "marketing",
      }),
      150
    );
    assert.equal(
      rewardAmountForPartner({
        partner_level: "standard",
        partner_type: "marketing",
      }),
      100
    );
    assert.equal(PARTNER_PAYMENT_METHOD_LABEL, "Interac e-Transfer");
  });
});

describe("Partner application approval language preserved", () => {
  it("application approval copy remains in apply success and status views", () => {
    const applySuccess = read("src/lib/partners/apply-success-copy.ts");
    assert.match(applySuccess, /application has been approved/i);
    const statusView = read("src/lib/partners/partner-status-view.ts");
    assert.match(statusView, /application is approved/i);
  });
});
