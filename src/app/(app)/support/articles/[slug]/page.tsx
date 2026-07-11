import Link from "next/link";
import { notFound } from "next/navigation";
import { SupportArticleView } from "@/components/support/support-article-view";
import { getArticleBySlug } from "@/lib/support/catalog";

export const dynamic = "force-dynamic";

export default async function SupportArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link href="/support" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Support
        </Link>
      </div>
      <SupportArticleView article={article} />
    </div>
  );
}
