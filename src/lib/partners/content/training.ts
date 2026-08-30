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
    body: `JobProof is a business platform designed to help contractors turn more opportunities into paying jobs — and manage that work from the first inquiry through payment.

Contractors use JobProof to:

- Make it easier for customers to request a quote
- Respond quickly with professional quotes
- Turn agreements into clear signed contracts
- Document and approve change orders so they have a better chance of getting paid for extra work
- Invoice customers and follow up on payment
- Keep job records that help protect the revenue they've earned

Saving time, looking professional, staying organized, and reducing disputes all matter — but they support the bigger goal: helping contractors grow and run a more successful business.

JobProof is built for Canadian contractors who want better tools for winning work, managing jobs, getting paid, and protecting what they've earned.`,
  },
  {
    slug: "ideal-contractor",
    title: "Who is the ideal contractor?",
    summary: "Focus referrals on contractors who get the most value.",
    body: `Ideal JobProof contractors typically:

- Work independently or with a small crew
- Take on residential or light commercial jobs
- Want to win more work and grow their business
- Need a better way to handle quote requests, quotes, contracts, changes, and invoicing
- Are ready to try software that replaces ad-hoc tools

Great fits include tradespeople in renovation, electrical, plumbing, painting, landscaping, and similar service businesses.

Less ideal: one-off DIY homeowners, or teams that already run a full enterprise ERP.`,
  },
  {
    slug: "how-to-introduce",
    title: "How to introduce JobProof",
    summary: "Lead with winning more work and growing the business.",
    body: `Lead with what matters most to contractors: winning more work and making more money.

1. Ask how they currently get new jobs, respond to quote requests, and follow up with potential customers.

2. Explain that JobProof is designed to help contractors turn more opportunities into paying jobs — from the initial quote request through quotes, contracts, changes and invoicing.

3. Highlight how JobProof makes it easier for customers to request a quote and easier for the contractor to respond quickly and professionally.

4. Share your referral link so they can try JobProof for themselves.

5. If they have questions you cannot answer, point them to JobProof Support.

---

**The main message**

JobProof isn't just about paperwork. It's a business tool designed to help contractors win more work, make more money, and protect the work they've earned.

Saving time, looking professional, staying organized and reducing disputes are important benefits — but they support the bigger goal of running a more successful contracting business.`,
  },
  {
    slug: "jobproof-conversation",
    title: "The JobProof conversation",
    summary: "A simple five-step framework for partner introductions.",
    body: `Use this short framework when introducing JobProof. Keep it conversational — not a scripted pitch.

**1. Find the pain**

Ask how the contractor currently gets leads, handles quote requests, follows up, manages contracts, and gets paid.

**2. Connect the opportunity**

Explain how JobProof can help turn more of that activity into organized, paying work.

**3. Show the workflow**

Quote request → Quote → Signed agreement → Job → Changes → Invoice → Documentation

**4. Lead with the outcome**

More opportunities converted into work, better control over payment, and less revenue lost through poor processes or disputes.

**5. Share your referral link**

Let the contractor explore JobProof and start their trial.

---

**Remember**

Talk about outcomes first, then features. JobProof provides tools and workflows that can help contractors win more work, manage it professionally, get paid, and protect the revenue they earn — without guaranteeing results.`,
  },
  {
    slug: "outcomes-before-features",
    title: "Sell outcomes before features",
    summary: "Connect every JobProof capability to a business result.",
    body: `Partners close more interest when they lead with what the contractor wants — not a feature list.

**Quote requests**

Weak: "JobProof captures quote requests."

Better: "Make it easier for customers to hire you — and easier for you to respond quickly."

**Quotes**

Weak: "JobProof creates professional quotes."

Better: "Help turn quote requests into paying jobs with a clear, professional quoting process."

**Contracts**

Weak: "JobProof manages contracts."

Better: "Once a customer is ready to move forward, JobProof helps turn the agreement into a clear signed contract."

**Change orders**

Weak: "JobProof handles change orders."

Better: "When the scope changes, JobProof helps contractors document and approve the additional work so they have a better chance of getting paid for it."

**Invoicing**

Weak: "JobProof creates invoices."

Better: "Invoice for completed work clearly and follow up so contractors can get paid for the jobs they've done."

**Documentation**

Weak: "JobProof organizes documentation."

Better: "Keep a clear record of the job so contractors can protect the revenue they've earned if a disagreement occurs."

Features still matter — teach them as the mechanisms that support winning work, getting paid, and protecting income.`,
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
Referral rewards qualify after the contractor remains a paying JobProof subscriber for 90 consecutive days.

**How much is the reward?**  
Creator and Marketing Founding Partners earn $150 CAD and Standard Partners earn $100 CAD for each qualified referral. Organization Partners earn a fixed $150 CAD per qualified referral. Rewards are one-time; there are no recurring commissions.`,
  },
  {
    slug: "referral-tips",
    title: "Tips for successful referrals",
    summary: "Quality over volume.",
    body: `- Share your link in places where contractors already trust you
- Prefer warm introductions over cold blasts
- Lead with how JobProof helps contractors win more work, turn opportunities into paying jobs, get paid, and protect the revenue they've earned
- Mention quotes, contracts, change orders, invoicing, and documentation as the tools that support those outcomes
- Use JobProof marketing resources for consistent branding
- Follow up once—then let the product speak for itself

Referral quality matters more than signup volume.`,
  },
];

export function getPartnerTrainingArticle(slug: string): PartnerTrainingArticle | null {
  return PARTNER_TRAINING_ARTICLES.find((a) => a.slug === slug) ?? null;
}
