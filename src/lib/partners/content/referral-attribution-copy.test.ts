import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PARTNER_LANDING_FAQS,
  PARTNER_PORTAL_FAQS,
} from "@/lib/partners/content/faqs";
import {
  FAQ_ATTRIBUTION_VS_QUALIFICATION_QUESTION,
  FAQ_MULTIPLE_PARTNERS_QUESTION,
  FAQ_REFERRAL_WINDOW_QUESTION,
  agreementAttributionSectionBody,
  agreementQualificationSectionBody,
  faqAttributionVsQualificationAnswer,
  faqMultiplePartnersAnswer,
  faqReferralWindowAnswer,
} from "@/lib/partners/content/referral-attribution-copy";
import { ORGANIZATION_FAQS } from "@/lib/partners/content/organizations";
import { PARTNER_TRAINING_ARTICLES } from "@/lib/partners/content/training";
import { buildMediaCenterFaqs } from "@/lib/partners/media-center-content";
import {
  FOUNDING_REWARD_CAD,
  PARTNER_AGREEMENT_VERSION,
  PARTNER_QUALIFICATION_DAYS,
  STANDARD_REWARD_CAD,
} from "@/lib/partners/constants";
import { PARTNER_REFERRAL_COOKIE_DAYS } from "@/lib/partners/partner-ref-cookie";
import { buildPartnerApprovedEmailContent } from "@/lib/partners/emails";

function allFaqText(faqs: { question: string; answer: string }[]): string {
  return faqs.map((f) => `${f.question}\n${f.answer}`).join("\n");
}

describe("partner attribution copy alignment", () => {
  it("public Partner FAQ documents the 30-day window and first-touch", () => {
    const text = allFaqText(PARTNER_LANDING_FAQS);
    assert.ok(
      PARTNER_LANDING_FAQS.some((f) => f.question === FAQ_REFERRAL_WINDOW_QUESTION)
    );
    assert.ok(
      PARTNER_LANDING_FAQS.some((f) => f.question === FAQ_MULTIPLE_PARTNERS_QUESTION)
    );
    assert.match(text, new RegExp(`${PARTNER_REFERRAL_COOKIE_DAYS}-day first-touch`));
    assert.match(faqReferralWindowAnswer(), /first-touch referral window/);
    assert.match(faqMultiplePartnersAnswer(), /does not replace your referral attribution/);
    assert.doesNotMatch(text, /120-day|localStorage|auth user|null-only/i);
  });

  it("distinguishes 30-day attribution from 90-day qualification", () => {
    const text = allFaqText(PARTNER_LANDING_FAQS) + "\n" + allFaqText(PARTNER_PORTAL_FAQS);
    assert.ok(
      PARTNER_LANDING_FAQS.some(
        (f) => f.question === FAQ_ATTRIBUTION_VS_QUALIFICATION_QUESTION
      )
    );
    assert.ok(
      PARTNER_PORTAL_FAQS.some(
        (f) => f.question === FAQ_ATTRIBUTION_VS_QUALIFICATION_QUESTION
      )
    );
    const explained = faqAttributionVsQualificationAnswer();
    assert.match(explained, new RegExp(`${PARTNER_REFERRAL_COOKIE_DAYS}-day`));
    assert.match(
      explained,
      new RegExp(`${PARTNER_QUALIFICATION_DAYS}-day paid-subscription`)
    );
    assert.match(explained, /separate/i);
    assert.match(explained, /does not guarantee a payable reward/i);
    assert.match(text, /30-day referral window only covers attribution/i);
  });

  it("Portal FAQ explains the operational attribution flow", () => {
    const how = PARTNER_PORTAL_FAQS.find((f) => f.question === "How do referrals work?");
    assert.ok(how);
    assert.match(how!.answer, /30-day first-touch/);
    assert.match(how!.answer, /referral attached to account/i);
    assert.match(how!.answer, /90 consecutive paid days/i);
    assert.match(how!.answer, /does not by itself create a payable reward/i);
  });

  it("Training and Resources do not contradict the 30-day / 90-day rules", () => {
    const common = PARTNER_TRAINING_ARTICLES.find((a) => a.slug === "common-questions");
    const tips = PARTNER_TRAINING_ARTICLES.find((a) => a.slug === "referral-tips");
    assert.ok(common && tips);
    assert.match(common!.body, /30-day first-touch referral window/);
    assert.match(common!.body, /90 consecutive days/);
    assert.match(common!.body, /separate from the 30-day referral window/);
    assert.match(tips!.body, /30-day first-touch referral window/);
    assert.match(tips!.body, /Do not ask people to repeatedly click/);
    assert.doesNotMatch(common!.body + tips!.body, /120-day/);
  });

  it("Organization Partner materials use the same attribution window and $150 reward", () => {
    const earnings = ORGANIZATION_FAQS.find(
      (f) => f.question === "How much do Organization Partners earn?"
    );
    const tracking = ORGANIZATION_FAQS.find(
      (f) => f.question === "How are referrals tracked?"
    );
    assert.ok(earnings && tracking);
    assert.match(earnings!.answer, /\$150 CAD/);
    assert.match(earnings!.answer, /no Founding or Standard/i);
    assert.match(earnings!.answer, /30-day first-touch/);
    assert.match(tracking!.answer, /same 30-day first-touch/);
    assert.match(tracking!.answer, /90-consecutive-paid-day/);
    assert.doesNotMatch(allFaqText([...ORGANIZATION_FAQS]), /60-day|120-day/);
  });

  it("Partner Agreement covers attribution, qualification, Organization $150, and fraud", () => {
    const attribution = agreementAttributionSectionBody();
    const qualification = agreementQualificationSectionBody();
    assert.match(attribution, /30-day first-touch referral window/);
    assert.match(attribution, /first valid Partner referral/);
    assert.match(attribution, /browser referral cookie/);
    assert.match(attribution, /existing JobProof customers or accounts/);
    assert.match(attribution, /Duplicate, fraudulent, fabricated/);
    assert.match(qualification, /does not itself create a payable reward/);
    assert.match(
      qualification,
      new RegExp(`${PARTNER_QUALIFICATION_DAYS} consecutive days`)
    );
    assert.match(
      qualification,
      new RegExp(`Founding Partners earn \\$${FOUNDING_REWARD_CAD} CAD`)
    );
    assert.match(
      qualification,
      new RegExp(`Standard Partners earn \\$${STANDARD_REWARD_CAD} CAD`)
    );
    assert.match(
      qualification,
      new RegExp(
        `Organization Partners earn a fixed \\$${FOUNDING_REWARD_CAD} CAD`
      )
    );

    const agreementPage = readFileSync(
      join(process.cwd(), "src/app/partners/agreement/page.tsx"),
      "utf8"
    );
    assert.match(agreementPage, /agreementAttributionSectionBody/);
    assert.match(agreementPage, /agreementQualificationSectionBody/);
  });

  it("bumps the agreement version for the substantive attribution update", () => {
    assert.equal(PARTNER_AGREEMENT_VERSION, "2026-09-13");
    assert.notEqual(PARTNER_AGREEMENT_VERSION, "2026-07-01");
  });

  it("Media Centre and approval email distinguish attribution from qualification", () => {
    const media = buildMediaCenterFaqs("standard", "creator");
    const referrals = media.find((f) => f.question === "How do partner referrals work?");
    assert.ok(referrals);
    assert.match(referrals!.answer, /30-day first-touch/);
    assert.match(referrals!.answer, /90 consecutive days/);

    const email = buildPartnerApprovedEmailContent({
      to: "partner@example.com",
      contactName: "Alex",
      organizationName: "Alex Media",
      level: "standard",
      partnerType: "creator",
      referralCode: "JP-TEST01",
      referralUrl: "https://jobproof.ca/signup?ref=JP-TEST01",
    });
    assert.match(email.html, /30-day first-touch referral window/);
    assert.match(email.html, /90 consecutive days/);
    assert.match(email.text, /30-day first-touch referral window/);
  });

  it("keeps reward amounts and 90-day qualification unchanged", () => {
    assert.equal(FOUNDING_REWARD_CAD, 150);
    assert.equal(STANDARD_REWARD_CAD, 100);
    assert.equal(PARTNER_QUALIFICATION_DAYS, 90);
    assert.equal(PARTNER_REFERRAL_COOKIE_DAYS, 30);
  });
});
