/** Partner training articles (code-backed, Success Center style). */

export type PartnerTrainingArticle = {
  slug: string;
  title: string;
  summary: string;
  body: string;
};

export const PARTNER_TRAINING_ARTICLES: PartnerTrainingArticle[] = [
  {
    slug: "what-is-jobproof",
    title: "What is JobProof?",
    summary: "A clear overview you can share with contractors.",
    body: `JobProof helps independent contractors go from the first customer inquiry to a signed quote and a well-documented job—organized in one place.

Contractors use JobProof to capture quote requests, prepare proposals, protect work with contracts and updates, and get paid with professional invoices.

It is built for Canadian contractors who want a more professional customer experience without juggling spreadsheets and scattered messages.`,
  },
  {
    slug: "ideal-contractor",
    title: "Who is the ideal contractor?",
    summary: "Focus referrals on contractors who get the most value.",
    body: `Ideal JobProof contractors typically:

- Work independently or with a small crew
- Take on residential or light commercial jobs
- Want clearer quotes, contracts, and documentation
- Are ready to try software that replaces ad-hoc tools

Great fits include tradespeople in renovation, electrical, plumbing, painting, landscaping, and similar service businesses.

Less ideal: one-off DIY homeowners, or teams that already run a full enterprise ERP.`,
  },
  {
    slug: "how-to-introduce",
    title: "How to introduce JobProof",
    summary: "A simple conversation framework.",
    body: `Keep introductions practical:

1. Ask how they currently handle quote requests and contracts.
2. Mention that JobProof organizes inquiries through signed quotes.
3. Share your referral link so they can start a free trial.
4. Offer to answer questions—or point them to JobProof Support.

Avoid overselling features. Focus on saving time, looking professional, and reducing disputes.`,
  },
  {
    slug: "common-questions",
    title: "Common questions",
    summary: "Answers partners hear most often.",
    body: `**Is there a free trial?**  
Yes — contractors get a 14-day free trial with no credit card required to start.

**Is JobProof for Canada?**  
Yes. JobProof is built for Canadian contractors.

**Do I need to manage their account?**  
No. Once they sign up with your link, JobProof supports them directly.

**When do I earn a reward?**  
After the contractor remains a paying JobProof subscriber for 90 consecutive days, the reward becomes eligible for manual review and approval.

**How much is the reward?**  
Founding Partners earn $150 CAD and Standard Partners earn $100 CAD for each qualified referral. Rewards are one-time; there are no recurring commissions.`,
  },
  {
    slug: "referral-tips",
    title: "Tips for successful referrals",
    summary: "Quality over volume.",
    body: `- Share your link in places where contractors already trust you
- Prefer warm introductions over cold blasts
- Explain the 90 consecutive-day paying-subscriber qualification clearly
- Use JobProof marketing resources for consistent branding
- Follow up once—then let the product speak for itself

Referral quality matters more than signup volume. Rewards are reviewed, approved, and paid manually.`,
  },
];

export function getPartnerTrainingArticle(slug: string): PartnerTrainingArticle | null {
  return PARTNER_TRAINING_ARTICLES.find((a) => a.slug === slug) ?? null;
}
