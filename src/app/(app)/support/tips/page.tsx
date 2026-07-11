import Link from "next/link";
import { SupportArticleCard } from "@/components/support/support-article-card";
import { getArticlesByCategory } from "@/lib/support/catalog";

export const dynamic = "force-dynamic";

export default function SupportTipsPage() {
  const articles = getArticlesByCategory("tips");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link href="/support" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Support
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Tips for Winning More Work</h1>
        <p className="mt-2 text-zinc-600">
          Practical habits that help you book more jobs and protect your margin.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {articles.map((article) => (
          <SupportArticleCard key={article.slug} article={article} />
        ))}
      </div>
    </div>
  );
}
