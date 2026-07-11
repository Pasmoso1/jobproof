/**
 * Add new Success Center articles by exporting them from a content file
 * and including them in `catalog.ts` via getPublishedArticles().
 *
 * Markdown bodies are rendered by `renderSupportMarkdown`.
 * Optional future fields on SupportArticle: videoUrl, screenshots, relatedSlugs, viewCount, attachments.
 */
export { getPublishedArticles, getArticleBySlug, getArticlesByCategory, searchSupportContent } from "./catalog";
export { SUPPORT_CATEGORIES, articleHref, categoryLabel, SUPPORT_APP_VERSION } from "./types";
export type {
  SupportArticle,
  SupportCategory,
  SupportCategoryId,
  SupportFaq,
  SupportSearchHit,
} from "./types";
