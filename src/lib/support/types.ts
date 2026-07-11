/**
 * Contractor Success Center — content & article types.
 * Designed so videos, screenshots, related articles, and view counts
 * can be added later without redesigning the registry.
 */

export const SUPPORT_APP_VERSION = "0.1.0";

export type SupportCategoryId =
  | "getting-started"
  | "quote-requests"
  | "site-visits"
  | "quotes"
  | "customers"
  | "contracts"
  | "billing"
  | "tips";

export type SupportArticle = {
  slug: string;
  title: string;
  category: SupportCategoryId;
  summary: string;
  /** Markdown body */
  body: string;
  estimatedMinutes: number;
  /** ISO date YYYY-MM-DD */
  updatedAt: string;
  keywords: string[];
  published: boolean;
  /** Future: video embeds */
  videoUrl?: string | null;
  /** Future: screenshot paths / URLs */
  screenshots?: string[];
  /** Future: related article slugs */
  relatedSlugs?: string[];
  /** Future: analytics */
  viewCount?: number;
  attachments?: string[];
};

export type SupportCategory = {
  id: SupportCategoryId;
  title: string;
  description: string;
  href: string;
};

export type SupportFaq = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
};

export type SupportSearchHit =
  | {
      kind: "article";
      slug: string;
      title: string;
      summary: string;
      category: SupportCategoryId;
      href: string;
    }
  | {
      kind: "faq";
      id: string;
      title: string;
      summary: string;
      href: string;
    };

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Set up your account and complete your first wins in JobProof.",
    href: "/support/getting-started",
  },
  {
    id: "quote-requests",
    title: "Quote Requests",
    description: "Receive, respond to, and close inbound quote requests.",
    href: "/support/guides/quote-requests",
  },
  {
    id: "site-visits",
    title: "Site Visits",
    description: "Capture notes, photos, and voice notes on site.",
    href: "/support/guides/site-visits",
  },
  {
    id: "quotes",
    title: "Quotes",
    description: "Build, edit, and send professional proposals.",
    href: "/support/guides/quotes",
  },
  {
    id: "customers",
    title: "Customers",
    description: "Manage customers and review their history.",
    href: "/support/guides/customers",
  },
  {
    id: "contracts",
    title: "Contracts & Changes",
    description: "Digital contracts, change orders, and approvals.",
    href: "/support/guides/contracts",
  },
  {
    id: "billing",
    title: "Billing",
    description: "Trials, plans, storage, and trades.",
    href: "/support/guides/billing",
  },
  {
    id: "tips",
    title: "Tips for Winning More Work",
    description: "Practical habits that help you book more jobs.",
    href: "/support/tips",
  },
];

export function categoryLabel(id: SupportCategoryId): string {
  return SUPPORT_CATEGORIES.find((c) => c.id === id)?.title ?? id;
}

export function articleHref(slug: string): string {
  return `/support/articles/${slug}`;
}
