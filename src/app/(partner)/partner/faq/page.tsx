import { PARTNER_PORTAL_FAQS } from "@/lib/partners/content/faqs";

export default function PartnerFaqPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Partner FAQ</h1>
        <p className="mt-1 text-sm text-zinc-600">Answers about referrals, rewards, and payouts.</p>
      </div>
      <dl className="space-y-6">
        {PARTNER_PORTAL_FAQS.map((faq) => (
          <div key={faq.question} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <dt className="font-semibold text-zinc-900">{faq.question}</dt>
            <dd className="mt-2 text-sm text-zinc-600">{faq.answer}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
