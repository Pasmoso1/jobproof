import type { SupportArticle } from "@/lib/support/types";

function a(
  partial: Omit<SupportArticle, "published" | "category"> & { category?: SupportArticle["category"] }
): SupportArticle {
  return {
    published: true,
    category: partial.category ?? "getting-started",
    ...partial,
  };
}

export const GETTING_STARTED_ARTICLES: SupportArticle[] = [
  a({
    slug: "create-your-account",
    title: "Create your account",
    summary: "Sign up with your email and verify your account so you can start using JobProof.",
    estimatedMinutes: 2,
    updatedAt: "2026-07-11",
    keywords: ["signup", "register", "email", "verify", "account"],
    body: `
## Create your account

1. Open the JobProof signup page.
2. Enter your name, email, and a password.
3. Confirm your email using the link we send you.

Once your email is verified, you can choose a plan and finish setup. No credit card is required to create an account.
`.trim(),
  }),
  a({
    slug: "start-your-free-trial",
    title: "Start your free trial",
    summary: "Your 14-day free trial begins after you pick a plan and complete onboarding—not at signup.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["trial", "free", "14 days", "solo", "pro", "credit card"],
    body: `
## Start your free trial

JobProof gives you a full 14-day free trial on the plan you choose (Solo or Pro).

### Important

The trial clock does **not** start when you create your account. It starts only after you:

1. Select Solo or Pro
2. Complete your business profile (including primary trade)

Until then, JobProof will remind you to finish setup so you do not lose trial days while you are away.

### What you get

During the trial you receive the same limits and features as a paid subscriber on your selected plan. No credit card is required to begin.
`.trim(),
  }),
  a({
    slug: "complete-your-business-profile",
    title: "Complete your business profile",
    summary: "Add your business details so quotes, invoices, and proposals look professional.",
    estimatedMinutes: 4,
    updatedAt: "2026-07-11",
    keywords: ["business", "profile", "address", "phone", "onboarding"],
    body: `
## Complete your business profile

Your business profile powers how customers see you on proposals and documents.

Include:

- Business name
- Phone number
- Service address (street, city, province, postal code)

Accurate details help customers recognize your company and make follow-up easier. Completing this step is also required before your free trial begins.
`.trim(),
  }),
  a({
    slug: "choose-your-trades",
    title: "Choose your trades",
    summary: "Set your primary trade (and additional trades on Pro) so quote requests match your work.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["trades", "primary trade", "solo", "pro", "limits"],
    body: `
## Choose your trades

Your primary trade tells JobProof what kind of work you do. It helps organize quote requests and keeps your public quote page relevant.

- **Solo** includes a limited number of trades.
- **Pro** supports more trades for multi-service contractors.

You can update trades later in Settings, subject to your plan limits.
`.trim(),
  }),
  a({
    slug: "add-your-first-customer",
    title: "Add your first customer",
    summary: "Create a customer record so quotes, jobs, and history stay organized in one place.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["customer", "contact", "add customer"],
    body: `
## Add your first customer

Customers are the people and households you work with. Adding them early keeps quotes and job history connected.

1. Open Customers (or create a customer while building a quote).
2. Enter name, phone, and email when you have them.
3. Save the record.

You can always edit details later as you learn more about the job.
`.trim(),
  }),
  a({
    slug: "receive-your-first-quote-request",
    title: "Receive your first quote request",
    summary: "See how inbound quote requests arrive and where to review them.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["quote request", "inbound", "lead", "notification"],
    body: `
## Receive your first quote request

When a homeowner submits a request through your quote page, it appears under **Quote Requests**.

From there you can:

- Review project details
- Respond or request a site visit
- Decline requests that are not a fit

Responding quickly is one of the best ways to win more work.
`.trim(),
  }),
  a({
    slug: "build-your-first-quote",
    title: "Build your first quote",
    summary: "Turn a request or site visit into a clear, professional quote.",
    estimatedMinutes: 5,
    updatedAt: "2026-07-11",
    keywords: ["quote", "estimate", "line items", "proposal"],
    body: `
## Build your first quote

A strong quote is clear about scope, price, and next steps.

1. Open the quote request or start a new estimate.
2. Capture the work included (and anything excluded when it matters).
3. Review totals before you mark the quote ready.

JobProof is designed to help you move from inquiry to a sendable proposal without losing details from the site visit.
`.trim(),
  }),
  a({
    slug: "send-your-first-proposal",
    title: "Send your first proposal",
    summary: "Share a professional proposal your customer can review and respond to.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["send", "proposal", "email", "customer"],
    body: `
## Send your first proposal

When your quote is ready:

1. Confirm customer contact details.
2. Send the proposal from JobProof.
3. Watch for views, questions, or acceptance.

Sending from JobProof keeps a record of what the customer saw, which reduces confusion later.
`.trim(),
  }),
  a({
    slug: "what-happens-after-customer-accepts",
    title: "What happens after the customer accepts",
    summary: "Learn the next steps once a proposal is accepted—jobs, contracts, and follow-through.",
    estimatedMinutes: 4,
    updatedAt: "2026-07-11",
    keywords: ["accepted", "job", "contract", "next steps"],
    body: `
## What happens after the customer accepts

When a customer accepts your proposal, you are ready to move the work forward.

Typical next steps:

1. Confirm schedule and scope.
2. Create or open the related job in JobProof.
3. Use contracts or change orders when the agreement needs a signature trail.
4. Keep photos and updates in the job record as work progresses.

Keeping everything in one place protects you if questions come up later.
`.trim(),
  }),
];
