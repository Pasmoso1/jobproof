import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  buildPartnerApprovedEmailContent,
} from "@/lib/partners/emails";
import {
  isPartnerReferralQualificationEligible,
} from "@/lib/partners/qualification";
import {
  buildMediaCenterFaqs,
} from "@/lib/partners/media-center-content";
import {
  resolvePartnerReferralSubscriptionStartedAt,
} from "@/lib/partners/attribution";
import { computePartnerDashboardStats } from "@/lib/partners/dashboard-stats";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("partner approval email content", () => {
  const base = {
    to: "partner@example.com",
    contactName: "Jordan",
    organizationName: "Northside Media",
    referralCode: "JP-ABC123",
    referralUrl: "https://jobproof.ca/signup?ref=JP-ABC123",
    username: "northside",
  };

  it("uses the canonical reward and level wording for creator/marketing partners", () => {
    const creatorFounding = buildPartnerApprovedEmailContent({
      ...base,
      level: "founding",
      partnerType: "creator",
    });
    const creatorStandard = buildPartnerApprovedEmailContent({
      ...base,
      level: "standard",
      partnerType: "creator",
    });
    const marketingFounding = buildPartnerApprovedEmailContent({
      ...base,
      level: "founding",
      partnerType: "marketing",
    });
    const marketingStandard = buildPartnerApprovedEmailContent({
      ...base,
      level: "standard",
      partnerType: "marketing",
    });

    assert.match(creatorFounding.text, /Founding Partner, \$150 CAD/);
    assert.match(creatorStandard.text, /Standard Partner, \$100 CAD/);
    assert.match(marketingFounding.text, /Founding Partner, \$150 CAD/);
    assert.match(marketingStandard.text, /Standard Partner, \$100 CAD/);
  });

  it("uses organization-specific wording and never mentions Founding or Standard", () => {
    const organization = buildPartnerApprovedEmailContent({
      ...base,
      organizationName: "Ontario Builders Association",
      level: "standard",
      partnerType: "organization",
    });

    assert.match(organization.text, /Organization Partner, \$150 CAD/);
    assert.doesNotMatch(organization.text, /Founding Partner|Standard Partner/);
    assert.doesNotMatch(organization.html, /Founding Partner|Standard Partner/);
  });
});

describe("partner referral paid-period transitions", () => {
  const NOW = new Date("2026-09-03T12:00:00.000Z");
  const PRIOR = "2026-08-01T00:00:00.000Z";

  it("does not start the clock while trialing", () => {
    assert.equal(
      resolvePartnerReferralSubscriptionStartedAt({
        rewardStatus: "pending",
        currentStartedAt: null,
        nextSubscriptionStatus: "trialing",
        now: NOW,
      }),
      undefined
    );
  });

  it("starts the clock when the referral becomes actively paid", () => {
    assert.equal(
      resolvePartnerReferralSubscriptionStartedAt({
        rewardStatus: "pending",
        currentStartedAt: null,
        nextSubscriptionStatus: "active",
        now: NOW,
      }),
      NOW.toISOString()
    );
  });

  it("resets the clock on cancellation or past_due and restarts on reactivation", () => {
    assert.equal(
      resolvePartnerReferralSubscriptionStartedAt({
        rewardStatus: "pending",
        currentStartedAt: PRIOR,
        nextSubscriptionStatus: "canceled",
        now: NOW,
      }),
      null
    );
    assert.equal(
      resolvePartnerReferralSubscriptionStartedAt({
        rewardStatus: "pending",
        currentStartedAt: PRIOR,
        nextSubscriptionStatus: "past_due",
        now: NOW,
      }),
      null
    );
    assert.equal(
      resolvePartnerReferralSubscriptionStartedAt({
        rewardStatus: "pending",
        currentStartedAt: null,
        nextSubscriptionStatus: "active",
        now: NOW,
      }),
      NOW.toISOString()
    );
  });

  it("does not rewrite already-qualified historical referrals", () => {
    assert.equal(
      resolvePartnerReferralSubscriptionStartedAt({
        rewardStatus: "qualified",
        currentStartedAt: PRIOR,
        nextSubscriptionStatus: "past_due",
        now: NOW,
      }),
      undefined
    );
  });
});

describe("partner referral qualification eligibility", () => {
  const NOW = new Date("2026-09-03T12:00:00.000Z");

  it("requires 90 consecutive active paid days", () => {
    assert.equal(
      isPartnerReferralQualificationEligible({
        subscriptionStartedAt: "2026-06-05T12:00:00.000Z",
        subscriptionStatus: "active",
        now: NOW,
      }),
      true
    );
    assert.equal(
      isPartnerReferralQualificationEligible({
        subscriptionStartedAt: "2026-06-06T12:00:01.000Z",
        subscriptionStatus: "active",
        now: NOW,
      }),
      false
    );
  });

  it("does not qualify trialing or past_due referrals", () => {
    for (const status of ["trialing", "past_due"]) {
      assert.equal(
        isPartnerReferralQualificationEligible({
          subscriptionStartedAt: "2026-06-01T12:00:00.000Z",
          subscriptionStatus: status,
          now: NOW,
        }),
        false
      );
    }
  });
});

describe("launch correction regression guards", () => {
  it("removes unsafe direct partner updates and public application inserts in SQL", () => {
    const migration = read("supabase/migrations/068_partner_launch_corrections.sql");
    assert.match(migration, /DROP POLICY IF EXISTS partners_update_own_payment/i);
    assert.match(migration, /DROP POLICY IF EXISTS partners_update_own_auth_user/i);
    assert.match(migration, /DROP POLICY IF EXISTS partner_applications_insert_public/i);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.record_partner_batch_payout/i);
    assert.match(migration, /partner_attribution_failures/i);
  });

  it("uses trusted server-side writes for payment email and partner application submission", () => {
    const portalActions = read("src/app/(partner)/partner/(portal)/actions.ts");
    const partnerActions = read("src/app/partners/actions.ts");
    assert.match(portalActions, /const admin = createServiceRoleClient\(\)/);
    assert.doesNotMatch(portalActions, /const supabase = await createClient\(\)/);
    assert.match(partnerActions, /admin\.from\(table\)\.insert\(row\)/);
  });

  it("excludes organization partners from founding capacity and removes org founding approval chrome", () => {
    const approve = read("src/lib/partners/approve.ts");
    const adminClient = read("src/app/admin/partners/admin-partners-client.tsx");
    assert.match(approve, /\.neq\("partner_type", "organization"\)/);
    assert.match(approve, /isOrganizationPartnerType\(application\.partner_type\)/);
    assert.match(adminClient, /!isOrgApplication \? \(/);
  });

  it("keeps organization media-centre reward copy free of Founding and Standard labels", () => {
    const faqs = buildMediaCenterFaqs("standard", "organization");
    const rewardFaq = faqs.find((item) => item.question === "How much do partners earn?");
    assert.ok(rewardFaq);
    assert.match(rewardFaq!.answer, /\$150 CAD/);
    assert.doesNotMatch(rewardFaq!.answer, /Founding Partner|Standard Partner/);
  });

  it("shows partner-referred signup context in the signup page", () => {
    const signup = read("src/app/(auth)/signup/page.tsx");
    assert.match(signup, /readPartnerRefClient/);
    assert.match(signup, /Win more work\. Manage every job\. Get paid\./);
    assert.match(signup, /You&apos;re continuing from a JobProof partner referral\./);
  });

  it("does not double-count approved rewards in partner dashboard totals", () => {
    const stats = computePartnerDashboardStats(
      [
        { reward_status: "pending", reward_amount: 150, subscription_started_at: null },
        { reward_status: "qualified", reward_amount: 150, subscription_started_at: "2026-06-01" },
        { reward_status: "approved", reward_amount: 100, subscription_started_at: "2026-06-01" },
        { reward_status: "needs_review", reward_amount: 150, subscription_started_at: "2026-06-01" },
        { reward_status: "paid", reward_amount: 100, subscription_started_at: "2026-06-01" },
      ],
      [{ amount: 100 }]
    );

    assert.equal(stats.qualifiedCount, 3);
    assert.equal(stats.qualifiedAmountCad, 400);
    assert.equal(stats.approvedRewardCount, 1);
    assert.equal(stats.approvedAmountCad, 100);
  });
});
