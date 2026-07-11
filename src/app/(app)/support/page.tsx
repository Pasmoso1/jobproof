import Link from "next/link";
import { SupportSearch } from "@/components/support/support-search";
import { SupportCategoryCard } from "@/components/support/support-article-card";
import { SUPPORT_CATEGORIES } from "@/lib/support/types";

export const dynamic = "force-dynamic";

export default function SupportHomePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div className="text-center sm:text-left">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          Contractor Success Center
        </h1>
        <p className="mt-2 text-base text-zinc-600 sm:text-lg">
          Everything you need to get the most out of JobProof.
        </p>
      </div>

      <SupportSearch autoFocus />

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">Browse by topic</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SUPPORT_CATEGORIES.map((cat) => (
            <SupportCategoryCard
              key={cat.id}
              title={cat.title}
              description={cat.description}
              href={cat.href}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/support/faq"
          className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-[#2436BB]/40"
        >
          <h3 className="font-semibold text-zinc-900">FAQ</h3>
          <p className="mt-1 text-sm text-zinc-600">Quick answers to common questions.</p>
        </Link>
        <Link
          href="/support/contact"
          className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-[#2436BB]/40"
        >
          <h3 className="font-semibold text-zinc-900">Contact Support</h3>
          <p className="mt-1 text-sm text-zinc-600">Send us a message when you need help.</p>
        </Link>
        <Link
          href="/support/feature-requests"
          className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-[#2436BB]/40"
        >
          <h3 className="font-semibold text-zinc-900">Feature Requests</h3>
          <p className="mt-1 text-sm text-zinc-600">Tell us what would make JobProof better.</p>
        </Link>
      </section>
    </div>
  );
}
