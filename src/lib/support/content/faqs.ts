import type { SupportFaq } from "@/lib/support/types";

export const SUPPORT_FAQS: SupportFaq[] = [
  {
    id: "how-does-free-trial-work",
    question: "How does the free trial work?",
    answer:
      "JobProof includes a 14-day free trial on Solo or Pro. The trial starts after you choose a plan and complete your business profile (including primary trade)—not when you first create your account. No credit card is required to begin.",
    keywords: ["trial", "free trial", "14 days", "onboarding"],
  },
  {
    id: "need-credit-card",
    question: "Do I need a credit card?",
    answer:
      "No. You can create an account, finish setup, and use your full free trial without entering a credit card. You only pay when you choose to subscribe.",
    keywords: ["credit card", "payment", "stripe", "subscribe"],
  },
  {
    id: "change-plans-later",
    question: "Can I change plans later?",
    answer:
      "During the free trial your selected plan is locked so you can evaluate it. When you subscribe—or after you are a paying customer—you can choose Solo or Pro from Billing.",
    keywords: ["plans", "solo", "pro", "upgrade", "downgrade"],
  },
  {
    id: "use-on-phone",
    question: "Can I use JobProof on my phone?",
    answer:
      "Yes. JobProof is built to work in a mobile browser so you can review requests, capture notes, and take photos on site.",
    keywords: ["mobile", "phone", "tablet", "responsive"],
  },
  {
    id: "electronic-signatures",
    question: "Can customers sign electronically?",
    answer:
      "Yes. JobProof supports digital contracts and change orders so customers can review and approve electronically.",
    keywords: ["sign", "signature", "esign", "contract"],
  },
  {
    id: "when-trial-ends",
    question: "What happens when my trial ends?",
    answer:
      "Your information is kept. The account becomes read-only so you can still view customers, quotes, and history. Subscribe anytime from Billing to create new work again.",
    keywords: ["trial ended", "expired", "read-only", "subscribe"],
  },
  {
    id: "upload-photos",
    question: "Can I upload photos?",
    answer:
      "Yes. You can upload photos for site visits and job documentation, subject to your plan’s storage allowance.",
    keywords: ["photos", "upload", "images", "storage"],
  },
  {
    id: "customer-wants-changes",
    question: "What if a customer wants changes?",
    answer:
      "Update the proposal before acceptance, or use a change order after work is underway. Always get clear approval before starting unpaid extra work.",
    keywords: ["changes", "change order", "revision"],
  },
  {
    id: "information-secure",
    question: "Is my information secure?",
    answer:
      "JobProof uses authenticated access, encrypted connections, and database security policies so only you can access your contractor data under normal operation.",
    keywords: ["security", "privacy", "secure", "data"],
  },
  {
    id: "export-data",
    question: "Can I export my data?",
    answer:
      "You can view and work with your customers, quotes, and project records in JobProof. If you need a specific export for accounting or migration, contact Support and tell us what you need.",
    keywords: ["export", "download", "data", "csv"],
  },
];
