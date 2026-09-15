/**
 * Partner-facing referral attribution copy aligned with implemented rules:
 * 30-day first-touch anonymous window + permanent account attribution +
 * separate 90-day paid qualification.
 */
import {
  FOUNDING_REWARD_CAD,
  PARTNER_QUALIFICATION_DAYS,
  STANDARD_REWARD_CAD,
} from "@/lib/partners/constants";
import { PARTNER_REFERRAL_COOKIE_DAYS } from "@/lib/partners/partner-ref-cookie";

export { PARTNER_REFERRAL_COOKIE_DAYS, PARTNER_QUALIFICATION_DAYS };

/** Public /partners FAQ — referral window length. */
export const FAQ_REFERRAL_WINDOW_QUESTION =
  "How long does my referral link track a visitor?";

export function faqReferralWindowAnswer(): string {
  return `JobProof uses a ${PARTNER_REFERRAL_COOKIE_DAYS}-day first-touch referral window. If someone visits JobProof through your referral link and creates their account within ${PARTNER_REFERRAL_COOKIE_DAYS} days, the referral can be credited to you. Once the referral is attached to their JobProof account, it remains associated with you even after the ${PARTNER_REFERRAL_COOKIE_DAYS}-day window ends. If they visit through another Partner’s link during your active ${PARTNER_REFERRAL_COOKIE_DAYS}-day window, your original referral attribution is not replaced.`;
}

/** Public / portal FAQ — multiple Partner links. */
export const FAQ_MULTIPLE_PARTNERS_QUESTION =
  "What if someone clicks referral links from more than one Partner?";

export function faqMultiplePartnersAnswer(): string {
  return `JobProof uses first-touch attribution during the ${PARTNER_REFERRAL_COOKIE_DAYS}-day referral window. If someone first visits JobProof through your valid referral link, another Partner link clicked during that active window does not replace your referral attribution. If the visitor does not create an account before the attribution window expires, a later Partner referral may establish a new referral window.`;
}

/** Distinguishes attribution window from reward qualification. */
export function faqAttributionVsQualificationAnswer(): string {
  return `These are separate steps. JobProof uses a ${PARTNER_REFERRAL_COOKIE_DAYS}-day first-touch referral window to attribute a visitor who follows your link and later creates a JobProof account. Once attached to the account, that attribution remains in place. Separately, a referral reward qualifies only after the referred contractor remains a paying JobProof subscriber for ${PARTNER_QUALIFICATION_DAYS} consecutive days under JobProof’s paid-subscription qualification rules. Example: a contractor clicks your referral link on September 1 and creates a JobProof account on September 20. The referral can be attributed to you because the account was created within the ${PARTNER_REFERRAL_COOKIE_DAYS}-day referral window. The separate ${PARTNER_QUALIFICATION_DAYS}-day paid-subscription qualification period applies when determining whether your referral reward qualifies. Attribution alone does not guarantee a payable reward.`;
}

export const FAQ_ATTRIBUTION_VS_QUALIFICATION_QUESTION =
  "What’s the difference between the 30-day referral window and the 90-day qualification?";

export function portalHowReferralsWorkAnswer(): string {
  return `Share your unique referral link or code. JobProof uses a ${PARTNER_REFERRAL_COOKIE_DAYS}-day first-touch referral window: if a contractor visits through your link and creates their JobProof account within that window, the referral can be attached to their account. Once attached, it stays with you even if the referral window later ends, they clear browser data, or they use another device. Another Partner’s link does not replace that account attribution. How referral attribution works in short: referral link clicked → ${PARTNER_REFERRAL_COOKIE_DAYS}-day first-touch window → contractor creates account → referral attached to account → contractor becomes a paying subscriber → ${PARTNER_QUALIFICATION_DAYS} consecutive paid days → reward may qualify. Attribution does not by itself create a payable reward; existing eligibility, fraud, and review rules still apply.`;
}

export function organizationReferralTrackingAnswer(): string {
  return `Approved organizations receive a unique referral link and code. JobProof uses the same ${PARTNER_REFERRAL_COOKIE_DAYS}-day first-touch referral window as the rest of the Partner Program. Signups created within that window through your link can be attributed to your organization partner account. Once attached to the contractor’s account, that attribution remains in place. Reward qualification follows the separate ${PARTNER_QUALIFICATION_DAYS}-consecutive-paid-day rules.`;
}

export function mediaCenterReferralsAnswer(): string {
  return `Each approved partner receives a referral code or link. JobProof uses a ${PARTNER_REFERRAL_COOKIE_DAYS}-day first-touch referral window; when a contractor creates an account within that window through your link, the referral can be permanently attached to their account. Rewards qualify after the referred contractor remains a paying subscriber for ${PARTNER_QUALIFICATION_DAYS} consecutive days, and qualified referrals are included in an upcoming Interac e-Transfer payout.`;
}

export function agreementAttributionSectionBody(): string {
  return `A prospective customer who follows a valid Partner referral link or uses a valid Partner referral code may be attributed to that Partner under a ${PARTNER_REFERRAL_COOKIE_DAYS}-day first-touch referral window. Where multiple Partner referral links or codes are used during an active attribution window, JobProof generally credits the first valid Partner referral captured during that window. If no JobProof account is created before that anonymous attribution window expires, the attribution may expire and a subsequent valid Partner referral may establish a new attribution. Once a valid referral is associated with a newly created JobProof account, expiration or deletion of the browser referral cookie does not by itself terminate or transfer that attribution. Partner referral links are intended for new customer acquisition and do not automatically create retroactive Partner attribution for existing JobProof customers or accounts. JobProof records are used to resolve attribution questions. Self-referrals require explicit written approval. Duplicate, fraudulent, fabricated, manipulated, or otherwise abusive referrals are not eligible.`;
}

export function agreementQualificationSectionBody(): string {
  return `Referral attribution does not itself create a payable reward. A referral qualifies only after the referred contractor becomes a paying JobProof subscriber and remains a paying subscriber for ${PARTNER_QUALIFICATION_DAYS} consecutive days under JobProof’s paid-subscription qualification rules. Creator and Marketing Founding Partners earn $${FOUNDING_REWARD_CAD} CAD per qualified referral. Creator and Marketing Standard Partners earn $${STANDARD_REWARD_CAD} CAD per qualified referral. Organization Partners earn a fixed $${FOUNDING_REWARD_CAD} CAD per qualified referral and are not classified as Founding or Standard for reward purposes. One qualified referral earns one one-time reward. There are no recurring, percentage, lifetime, or multi-level commissions.`;
}
