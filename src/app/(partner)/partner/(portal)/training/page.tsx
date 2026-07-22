import Link from "next/link";
import { PARTNER_TRAINING_ARTICLES } from "@/lib/partners/content/training";

export default function PartnerTrainingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Training</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Short guides to help you introduce JobProof confidently.
        </p>
      </div>
      <ul className="space-y-3">
        {PARTNER_TRAINING_ARTICLES.map((a) => (
          <li key={a.slug}>
            <Link
              href={`/partner/training/${a.slug}`}
              className="block rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-[#2436BB]/40"
            >
              <p className="font-semibold text-zinc-900">{a.title}</p>
              <p className="mt-1 text-sm text-zinc-600">{a.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
