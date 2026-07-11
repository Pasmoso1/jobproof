import Link from "next/link";
import { notFound } from "next/navigation";
import { SupportArticleCard } from "@/components/support/support-article-card";
import { SupportSearch } from "@/components/support/support-search";
import { getArticlesByCategory } from "@/lib/support/catalog";
import { SUPPORT_CATEGORIES, type SupportCategoryId } from "@/lib/support/types";

export const dynamic = "force-dynamic";

const GUIDE_CATEGORY_IDS = new Set<SupportCategoryId>([
  "quote-requests",
  "site-visits",
  "quotes",
  "customers",
  "contracts",
  "billing",
]);

export default async function SupportGuideCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: raw } = await params;
  const category = raw as SupportCategoryId;
  if (!GUIDE_CATEGORY_IDS.has(category)) notFound();

  const meta = SUPPORT_CATEGORIES.find((c) => c.id === category);
  if (!meta) notFound();

  const articles = getArticlesByCategory(category);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link href="/support" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Support
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">{meta.title}</h1>
        <p className="mt-2 text-zinc-600">{meta.description}</p>
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
