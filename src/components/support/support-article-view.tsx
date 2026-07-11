import { renderSupportMarkdown } from "@/lib/support/markdown";
import type { SupportArticle } from "@/lib/support/types";
import { categoryLabel } from "@/lib/support/types";
import { formatArticleDate } from "@/components/support/support-article-card";
import Link from "next/link";

export function SupportArticleView({ article }: { article: SupportArticle }) {
  return (
    <article className="mx-auto max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {categoryLabel(article.category)}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">{article.title}</h1>
      <p className="mt-3 text-base text-zinc-600">{article.summary}</p>
      <p className="mt-2 text-sm text-zinc-500">
        {article.estimatedMinutes} min read · Last updated {formatArticleDate(article.updatedAt)}
      </p>
      <div className="prose-support mt-8">{renderSupportMarkdown(article.body)}</div>
      <div className="mt-10 border-t border-zinc-200 pt-6">
        <Link href="/support" className="text-sm font-medium text-[#2436BB] hover:text-[#1c2a96]">
          ← Back to Contractor Success Center
        </Link>
      </div>
    </article>
  );
}
