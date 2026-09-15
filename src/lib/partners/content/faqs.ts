import {
  FAQ_ATTRIBUTION_VS_QUALIFICATION_QUESTION,
  FAQ_MULTIPLE_PARTNERS_QUESTION,
  FAQ_REFERRAL_WINDOW_QUESTION,
  faqAttributionVsQualificationAnswer,
  faqMultiplePartnersAnswer,
  faqReferralWindowAnswer,
  portalHowReferralsWorkAnswer,
} from "@/lib/partners/content/referral-attribution-copy";

export type PartnerFaqItem = { question: string; answer: string };

export const PARTNER_PORTAL_FAQS: PartnerFaqItem[] = [
  {
    question: "How do referrals work?",
    answer: portalHowReferralsWorkAnswer(),
  },
  {
    question: FAQ_REFERRAL_WINDOW_QUESTION,
    answer: faqReferralWindowAnswer(),
  },
  {
    question: FAQ_MULTIPLE_PARTNERS_QUESTION,
    answer: faqMultiplePartnersAnswer(),
  },
  {
    question: FAQ_ATTRIBUTION_VS_QUALIFICATION_QUESTION,
    answer: faqAttributionVsQualificationAnswer(),
  },
  {
    question: "When do I get paid?",
    answer:
      "A referral qualifies for payment after the referred contractor has remained a paying JobProof subscriber for 90 consecutive days. Once the referral qualifies, it becomes eligible for your next Interac e-Transfer payout to the payment email listed in your Partner account.",
  },
  {
    question: "What qualifies for a reward?",
    answer:
      "One qualified referral equals one one-time reward. The referred contractor must become a paying JobProof subscriber and remain subscribed for 90 consecutive days. There are no recurring or percentage commissions. The 30-day referral window only covers attribution at signup; it is not the qualification period.",
  },
  {
    question: "How much is each reward?",
    answer:
      "Creator and Marketing Founding Partners earn $150 CAD and Standard Partners earn $100 CAD per qualified referral. Organization Partners earn a fixed $150 CAD per qualified referral. Each reward is one-time.",
  },
  {
    question: "Can I refer multiple contractors?",
    answer:
      "Yes, but referral quality matters more than signup volume. Refer contractors who are a genuine fit for JobProof.",
  },
  {
    question: "How do I update my payment information?",
    answer:
      "Update your Interac e-Transfer payment email under Earnings in the Partner Portal. It can be different from your JobProof login email.",
  },
];

export const PARTNER_LANDING_FAQS: PartnerFaqItem[] = [
  {
    question: "Who can apply?",
    answer:
      "Organizations and individuals who regularly work with independent contractors — including influencers, trade groups, coaches, accounting firms, insurers, financing partners, and existing JobProof contractors.",
  },
  {
    question: FAQ_REFERRAL_WINDOW_QUESTION,
    answer: faqReferralWindowAnswer(),
  },
  {
    question: FAQ_MULTIPLE_PARTNERS_QUESTION,
    answer: faqMultiplePartnersAnswer(),
  },
  {
    question: FAQ_ATTRIBUTION_VS_QUALIFICATION_QUESTION,
    answer: faqAttributionVsQualificationAnswer(),
  },
  {
    question: "How are referrals tracked?",
    answer:
      "Each approved partner receives a unique referral link and code. JobProof uses a 30-day first-touch referral window. When someone creates a JobProof account within that window through your link, the referral can be attached to their account and remains associated with you afterward.",
  },
  {
    question: "When do I get paid?",
    answer:
      "A referral qualifies for payment after the referred contractor has remained a paying JobProof subscriber for 90 consecutive days. Once the referral qualifies, rewards are included in your upcoming Interac e-Transfer payout to the payment email on your Partner account.",
  },
  {
    question: "Can I refer multiple contractors?",
    answer:
      "Yes. Every qualified referral earns a separate one-time reward, with no recurring commissions. Referral quality matters more than signup volume.",
  },
  {
    question: "Is there a cost to join?",
    answer: "No. There is no fee to apply or participate.",
  },
  {
    question: "How do I receive payments?",
    answer:
      "JobProof pays by Interac e-Transfer to the payment email listed in your Partner account. That address can be different from your JobProof login email.",
  },
];
