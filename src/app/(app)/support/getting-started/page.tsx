import Link from "next/link";
import { SupportArticleCard } from "@/components/support/support-article-card";
import { SupportSearch } from "@/components/support/support-search";
import { getArticlesByCategory } from "@/lib/support/catalog";

export const dynamic = "force-dynamic";

export default function GettingStartedPage() {
  const articles = getArticlesByCategory("getting-started");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link href="/support" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Support
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Getting Started</h1>
        <p className="mt-2 text-zinc-600">
          Follow these guides to set up JobProof and complete your first wins.
        </p>
      </div>
      <SupportSearch compact />
      <div className="grid gap-3 sm:grid-cols-2">
        {articles.map((article) => (
          <SupportArticleCard key={article.slug} article={article} />
        ))}
      </div>
    </div>
  );
}
