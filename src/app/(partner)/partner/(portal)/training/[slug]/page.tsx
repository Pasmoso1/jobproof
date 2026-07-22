import Link from "next/link";
import { notFound } from "next/navigation";
import { getPartnerTrainingArticle } from "@/lib/partners/content/training";
import { renderSupportMarkdown } from "@/lib/support/markdown";

export default async function PartnerTrainingArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getPartnerTrainingArticle(slug);
  if (!article) notFound();

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <Link href="/partner/training" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
        ← Training
      </Link>
      <h1 className="text-2xl font-bold text-zinc-900">{article.title}</h1>
      <div className="prose prose-zinc max-w-none text-zinc-700">
        {renderSupportMarkdown(article.body)}
      </div>
    </article>
  );
}
