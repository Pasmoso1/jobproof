import Link from "next/link";
import type { SupportArticle } from "@/lib/support/types";
import { articleHref, categoryLabel } from "@/lib/support/types";

export function SupportArticleCard({ article }: { article: SupportArticle }) {
  return (
    <Link
      href={articleHref(article.slug)}
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-[#2436BB]/40 hover:shadow-sm"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {categoryLabel(article.category)}
      </p>
      <h3 className="mt-1 text-base font-semibold text-zinc-900">{article.title}</h3>
      <p className="mt-1 text-sm text-zinc-600">{article.summary}</p>
      <p className="mt-3 text-xs text-zinc-500">
        {article.estimatedMinutes} min read · Updated {formatArticleDate(article.updatedAt)}
      </p>
    </Link>
  );
}

export function formatArticleDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SupportCategoryCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-[#2436BB]/40 hover:shadow-sm"
    >
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 text-sm text-zinc-600">{description}</p>
      <p className="mt-3 text-sm font-medium text-[#2436BB]">Browse →</p>
    </Link>
  );
}
