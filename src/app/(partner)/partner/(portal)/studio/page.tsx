import Link from "next/link";
import { STUDIO_TAGLINE } from "@/lib/partners/studio/catalog";
import { listPartnerCampaigns } from "@/lib/partners/studio/actions";

export default async function PartnerMarketingStudioPage() {
  const campaigns = await listPartnerCampaigns();
  const recent = campaigns.slice(0, 3);

  return (
    <div className="space-y-10">
      <header className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#2436BB] via-[#4DBACC] to-[#F28C38]" />
        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2436BB]">
            Flagship partner feature
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
            Partner Marketing Studio
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-600">
            Create professional JobProof marketing campaigns in minutes.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
            Generate personalized graphics, social posts, email campaigns, flyers,
            website banners and more—all customized with your referral link, QR code
            and branding.
          </p>
          <p className="mt-4 text-sm font-medium text-[#1A2558]">{STUDIO_TAGLINE}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/partner/studio/create"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2436BB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
            >
              Create Campaign
            </Link>
            <Link
              href="/partner/studio/history"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Campaign History
            </Link>
            <Link
              href="/partner/media"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Open Media Centre
            </Link>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            title: "Personalized assets",
            body: "Every campaign includes your referral URL, code, and QR automatically.",
          },
          {
            title: "Built on Media Centre",
            body: "Reuses approved JobProof logos, social graphics, banners, and print files.",
          },
          {
            title: "Complete platform story",
            body: "Promote quotes, contracts, change orders, invoices, documentation, and more.",
          },
        ].map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-zinc-900">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.body}</p>
          </article>
        ))}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-zinc-950">Recent campaigns</h2>
          <Link
            href="/partner/studio/history"
            className="text-sm font-semibold text-[#2436BB] hover:underline"
          >
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
            <p className="text-sm text-zinc-600">
              No campaigns yet. Create your first personalized JobProof campaign.
            </p>
            <Link
              href="/partner/studio/create"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#F28C38] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#d97720]"
            >
              Create Campaign
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/partner/studio/campaigns/${c.id}`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-[#2436BB]/40"
                >
                  <p className="font-semibold text-zinc-900">{c.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(c.created_at).toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    {c.platforms.length} platform{c.platforms.length === 1 ? "" : "s"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Coming soon</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Future versions may support AI copy, seasonal campaigns, direct social
          publishing, analytics, A/B testing, and scheduling. Architecture is ready;
          these are not enabled yet.
        </p>
      </section>
    </div>
  );
}
