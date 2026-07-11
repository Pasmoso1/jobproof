import { GETTING_STARTED_ARTICLES } from "@/lib/support/content/getting-started";
import { GUIDE_ARTICLES } from "@/lib/support/content/guides";
import { TIPS_ARTICLES } from "@/lib/support/content/tips";
import { SUPPORT_FAQS } from "@/lib/support/content/faqs";
import {
  articleHref,
  type SupportArticle,
  type SupportCategoryId,
  type SupportFaq,
  type SupportSearchHit,
} from "@/lib/support/types";

const ALL_ARTICLES: SupportArticle[] = [
  ...GETTING_STARTED_ARTICLES,
  ...GUIDE_ARTICLES,
  ...TIPS_ARTICLES,
];

export function getPublishedArticles(): SupportArticle[] {
  return ALL_ARTICLES.filter((a) => a.published);
}

export function getArticleBySlug(slug: string): SupportArticle | null {
  const found = getPublishedArticles().find((a) => a.slug === slug);
  return found ?? null;
}

export function getArticlesByCategory(category: SupportCategoryId): SupportArticle[] {
  return getPublishedArticles().filter((a) => a.category === category);
}

export function getFaqs(): SupportFaq[] {
  return SUPPORT_FAQS;
}

function normalizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function scoreText(haystack: string, tokens: string[]): number {
  const h = haystack.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (h.includes(t)) score += 1;
  }
  return score;
}

/** Client-safe search across articles + FAQs. */
export function searchSupportContent(query: string): SupportSearchHit[] {
  const tokens = normalizeQuery(query);
  if (tokens.length === 0) return [];

  const articleHits: Array<SupportSearchHit & { score: number }> = [];
  for (const article of getPublishedArticles()) {
    const blob = [
      article.title,
      article.summary,
      article.keywords.join(" "),
      article.category,
      article.body,
    ].join("\n");
    const score = scoreText(blob, tokens);
    if (score > 0) {
      articleHits.push({
        kind: "article",
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        category: article.category,
        href: articleHref(article.slug),
        score: score + (scoreText(article.title, tokens) > 0 ? 2 : 0),
      });
    }
  }

  const faqHits: Array<SupportSearchHit & { score: number }> = [];
  for (const faq of getFaqs()) {
    const blob = [faq.question, faq.answer, faq.keywords.join(" ")].join("\n");
    const score = scoreText(blob, tokens);
    if (score > 0) {
      faqHits.push({
        kind: "faq",
        id: faq.id,
        title: faq.question,
        summary: faq.answer.slice(0, 160) + (faq.answer.length > 160 ? "…" : ""),
        href: `/support/faq#${faq.id}`,
        score: score + (scoreText(faq.question, tokens) > 0 ? 2 : 0),
      });
    }
  }

  return [...articleHits, ...faqHits]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .map((hit) => {
      if (hit.kind === "article") {
        return {
          kind: "article" as const,
          slug: hit.slug,
          title: hit.title,
          summary: hit.summary,
          category: hit.category,
          href: hit.href,
        };
      }
      return {
        kind: "faq" as const,
        id: hit.id,
        title: hit.title,
        summary: hit.summary,
        href: hit.href,
      };
    })
    .slice(0, 40);
}
