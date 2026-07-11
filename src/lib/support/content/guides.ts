import type { SupportArticle } from "@/lib/support/types";

function a(
  partial: Omit<SupportArticle, "published">
): SupportArticle {
  return { published: true, ...partial };
}

export const GUIDE_ARTICLES: SupportArticle[] = [
  // Quote Requests
  a({
    slug: "understanding-quote-requests",
    title: "Understanding quote requests",
    category: "quote-requests",
    summary: "What a quote request includes and how to read it quickly.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["quote request", "lead", "details", "urgent"],
    body: `
## Understanding quote requests

A quote request is an inbound inquiry from a potential customer. It typically includes contact details, a description of the work, and any photos or notes they provided.

Scan for:

- Location and access notes
- Timing or urgency
- Scope clarity (or gaps you still need to ask about)

Your goal is to decide: respond, request a site visit, or decline politely.
`.trim(),
  }),
  a({
    slug: "responding-to-customers",
    title: "Responding to customers",
    category: "quote-requests",
    summary: "Acknowledge requests quickly and set clear next steps.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["respond", "reply", "follow up", "customer"],
    body: `
## Responding to customers

A fast, clear response builds trust even before you quote.

Good responses:

- Confirm you received the request
- Ask only the questions you need
- Propose a site visit or next step with timing

Avoid long delays with no update—customers often hire the first contractor who communicates well.
`.trim(),
  }),
  a({
    slug: "requesting-a-site-visit",
    title: "Requesting a site visit",
    category: "quote-requests",
    summary: "When and how to schedule a site visit from a quote request.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["site visit", "schedule", "inspect"],
    body: `
## Requesting a site visit

Request a site visit when you need to see conditions before pricing accurately—access, materials, hidden issues, or safety concerns.

From the quote request:

1. Choose the option to request a site visit.
2. Confirm contact details and preferred times when available.
3. Arrive prepared to capture notes and photos in JobProof.
`.trim(),
  }),
  a({
    slug: "closing-a-request",
    title: "Closing a request",
    category: "quote-requests",
    summary: "Mark requests complete when you have quoted, won, or finished follow-up.",
    estimatedMinutes: 2,
    updatedAt: "2026-07-11",
    keywords: ["close", "complete", "status"],
    body: `
## Closing a request

Close a quote request when it no longer needs action—after you send a proposal, win the job, or finish follow-up.

Keeping your list clean helps you focus on active opportunities and avoids missing new requests.
`.trim(),
  }),
  a({
    slug: "declining-a-request",
    title: "Declining a request",
    category: "quote-requests",
    summary: "Politely decline work that is not a fit without burning the lead.",
    estimatedMinutes: 2,
    updatedAt: "2026-07-11",
    keywords: ["decline", "not a fit", "capacity"],
    body: `
## Declining a request

It is okay to decline. Common reasons include capacity, trade mismatch, or location.

When you decline in JobProof, choose a clear reason when prompted. A respectful decline keeps your reputation intact and frees time for the right jobs.
`.trim(),
  }),

  // Site Visits
  a({
    slug: "taking-notes",
    title: "Taking notes",
    category: "site-visits",
    summary: "Capture what you see on site so your quote stays accurate.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["notes", "site visit", "documentation"],
    body: `
## Taking notes

Site visit notes are your memory when you build the quote later.

Capture:

- Measurements and materials
- Customer preferences
- Risks or exclusions
- Anything that affects price or schedule

Write notes while you are still on site whenever possible.
`.trim(),
  }),
  a({
    slug: "recording-voice-notes",
    title: "Recording voice notes",
    category: "site-visits",
    summary: "Use voice notes when typing is inconvenient on the job.",
    estimatedMinutes: 2,
    updatedAt: "2026-07-11",
    keywords: ["voice", "audio", "notes", "mobile"],
    body: `
## Recording voice notes

Voice notes help when your hands are busy or conditions make typing hard.

Speak clearly, include room or area names, and review the note later when building the quote. Pair voice notes with photos for the strongest record.
`.trim(),
  }),
  a({
    slug: "taking-photos",
    title: "Taking photos",
    category: "site-visits",
    summary: "Photo documentation protects you and improves quote accuracy.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["photos", "images", "before", "documentation"],
    body: `
## Taking photos

Photos reduce disputes and help you price accurately.

Best practices:

- Capture before conditions
- Include wide and detail shots
- Photograph damage, access issues, and existing materials

Upload photos into JobProof so they stay with the request or job.
`.trim(),
  }),
  a({
    slug: "organizing-notes",
    title: "Organizing notes",
    category: "site-visits",
    summary: "Keep notes and media grouped so quoting is faster later.",
    estimatedMinutes: 2,
    updatedAt: "2026-07-11",
    keywords: ["organize", "notes", "photos", "structure"],
    body: `
## Organizing notes

Group notes by area or task (for example: exterior, electrical, cleanup). Consistent organization makes it easier to turn a site visit into a complete quote without missing items.
`.trim(),
  }),

  // Quotes
  a({
    slug: "building-a-quote",
    title: "Building a quote",
    category: "quotes",
    summary: "Structure scope and pricing so customers understand what they are buying.",
    estimatedMinutes: 5,
    updatedAt: "2026-07-11",
    keywords: ["build quote", "estimate", "pricing", "scope"],
    body: `
## Building a quote

A professional quote is easy to understand.

Include:

- Clear description of work
- Pricing that matches the scope
- Notes on exclusions when needed
- Timeline expectations when known

Use your site visit notes and photos while you build so nothing important is left out.
`.trim(),
  }),
  a({
    slug: "editing-a-quote",
    title: "Editing a quote",
    category: "quotes",
    summary: "Update drafts before sending, and handle revisions after customer feedback.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["edit", "revise", "draft"],
    body: `
## Editing a quote

Edit freely while a quote is still a draft. After sending, treat customer questions and change requests carefully so the customer always sees an accurate proposal.

If scope changes after acceptance, use a change order rather than silently adjusting the original agreement.
`.trim(),
  }),
  a({
    slug: "sending-a-proposal",
    title: "Sending a proposal",
    category: "quotes",
    summary: "Deliver a polished proposal and track customer engagement.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["send proposal", "email", "share"],
    body: `
## Sending a proposal

Before you send:

1. Double-check totals and scope wording
2. Confirm the customer email or phone
3. Send from JobProof so delivery is logged

After sending, follow up if you have not heard back within a few days.
`.trim(),
  }),
  a({
    slug: "customer-questions",
    title: "Customer questions",
    category: "quotes",
    summary: "Handle questions on a proposal without losing momentum.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["questions", "clarification", "customer"],
    body: `
## Customer questions

Questions are a buying signal. Answer promptly and clearly.

If the answer changes price or scope, update the proposal so both sides share the same understanding before acceptance.
`.trim(),
  }),
  a({
    slug: "customer-change-requests",
    title: "Customer change requests",
    category: "quotes",
    summary: "Respond to change requests with clear pricing and documentation.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["change request", "revision", "scope"],
    body: `
## Customer change requests

When a customer asks for different work:

1. Confirm what changed
2. Update pricing and scope
3. Resend or use a change order if work already started

Never begin unpaid extra work without a clear approval trail.
`.trim(),
  }),

  // Customers
  a({
    slug: "adding-customers",
    title: "Adding customers",
    category: "customers",
    summary: "Create and maintain customer records for quotes and jobs.",
    estimatedMinutes: 2,
    updatedAt: "2026-07-11",
    keywords: ["add customer", "contact", "crm"],
    body: `
## Adding customers

Add customers from the Customers area or while creating a quote. Keep phone and email current so proposals and invoices reach the right person.
`.trim(),
  }),
  a({
    slug: "customer-history",
    title: "Customer history",
    category: "customers",
    summary: "Review past work and communications for returning customers.",
    estimatedMinutes: 2,
    updatedAt: "2026-07-11",
    keywords: ["history", "past jobs", "returning"],
    body: `
## Customer history

Open a customer record to see related quotes and jobs. History helps you quote faster and speak confidently about previous work.
`.trim(),
  }),
  a({
    slug: "previous-quotes",
    title: "Previous quotes",
    category: "customers",
    summary: "Find earlier quotes to reuse context or compare pricing.",
    estimatedMinutes: 2,
    updatedAt: "2026-07-11",
    keywords: ["previous quotes", "past estimates"],
    body: `
## Previous quotes

Previous quotes show what was proposed before—useful for renewals, similar jobs, or disputes about what was included. Always verify current conditions before reusing old pricing.
`.trim(),
  }),

  // Contracts
  a({
    slug: "digital-contracts",
    title: "Digital contracts",
    category: "contracts",
    summary: "Use digital contracts to document agreements and collect signatures.",
    estimatedMinutes: 4,
    updatedAt: "2026-07-11",
    keywords: ["contract", "signature", "esign", "agreement"],
    body: `
## Digital contracts

Digital contracts create a clear record of what was agreed before work begins.

Typical flow:

1. Prepare the contract for the job
2. Send for signature
3. Confirm it is signed before starting major work

Electronic signatures help both you and the customer move faster without printing paperwork.
`.trim(),
  }),
  a({
    slug: "change-orders",
    title: "Change orders",
    category: "contracts",
    summary: "Document extra work and get approval before you proceed.",
    estimatedMinutes: 4,
    updatedAt: "2026-07-11",
    keywords: ["change order", "extra work", "approval"],
    body: `
## Change orders

Change orders protect your margin when scope expands.

1. Describe the additional work
2. Price it clearly
3. Send for customer approval
4. Start the extra work only after approval

This habit prevents awkward conversations at invoice time.
`.trim(),
  }),
  a({
    slug: "customer-approvals",
    title: "Customer approvals",
    category: "contracts",
    summary: "Track approvals so you know when you are clear to proceed.",
    estimatedMinutes: 2,
    updatedAt: "2026-07-11",
    keywords: ["approval", "signed", "authorize"],
    body: `
## Customer approvals

Approvals—on proposals, contracts, or change orders—are your green light. Keep an eye on pending signatures and follow up promptly so jobs do not stall.
`.trim(),
  }),

  // Billing
  a({
    slug: "free-trial",
    title: "Free trial",
    category: "billing",
    summary: "How JobProof’s 14-day free trial works and when it starts.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["trial", "free trial", "14 day", "billing"],
    body: `
## Free trial

Your free trial lasts 14 calendar days and starts after onboarding is complete (plan selected + business profile and primary trade).

No credit card is required to start. During the trial you get full access for your selected plan (Solo or Pro). When the trial ends, your account becomes read-only until you subscribe—your data remains available.
`.trim(),
  }),
  a({
    slug: "upgrading-plans",
    title: "Upgrading plans",
    category: "billing",
    summary: "Move between Solo and Pro when you are ready to subscribe or grow.",
    estimatedMinutes: 3,
    updatedAt: "2026-07-11",
    keywords: ["upgrade", "solo", "pro", "subscribe", "plan"],
    body: `
## Upgrading plans

During the free trial, your selected plan is locked so you can evaluate it fairly. When you subscribe (or after the trial), open **Billing** to choose Solo or Pro and complete payment with Stripe.

After you are subscribed, you can manage upgrades and billing from the same page.
`.trim(),
  }),
  a({
    slug: "storage-limits",
    title: "Storage limits",
    category: "billing",
    summary: "Understand photo and file storage on Solo vs Pro.",
    estimatedMinutes: 2,
    updatedAt: "2026-07-11",
    keywords: ["storage", "photos", "limits", "quota"],
    body: `
## Storage limits

Each plan includes a storage allowance for photos and files. Solo includes a smaller allowance; Pro includes more for contractors who document heavily on site.

Check Billing or your dashboard for current usage. Upgrading increases your allowance.
`.trim(),
  }),
  a({
    slug: "multiple-trades",
    title: "Multiple trades",
    category: "billing",
    summary: "How trade limits differ between Solo and Pro.",
    estimatedMinutes: 2,
    updatedAt: "2026-07-11",
    keywords: ["trades", "multiple trades", "pro", "solo"],
    body: `
## Multiple trades

Solo is built for focused contractors with a limited number of trades. Pro supports more trades for multi-service businesses.

If you need additional trades, upgrade to Pro from Billing after your trial or subscription begins.
`.trim(),
  }),
];
