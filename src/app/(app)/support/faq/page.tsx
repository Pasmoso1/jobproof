import Link from "next/link";
import { SupportFaqList } from "@/components/support/support-faq-list";
import { getFaqs } from "@/lib/support/catalog";

export const dynamic = "force-dynamic";

export default function SupportFaqPage() {
  const faqs = getFaqs();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href="/support" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Support
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">FAQ</h1>
        <p className="mt-2 text-zinc-600">Answers to the questions contractors ask most often.</p>
      </div>
      <SupportFaqList faqs={faqs} />
    </div>
  );
}
