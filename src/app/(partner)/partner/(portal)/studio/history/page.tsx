import Link from "next/link";
import { listPartnerCampaigns } from "@/lib/partners/studio/actions";
import {
  STUDIO_AUDIENCES,
  STUDIO_THEMES,
  studioOptionLabel,
} from "@/lib/partners/studio/catalog";

export default async function PartnerStudioHistoryPage() {
  const campaigns = await listPartnerCampaigns();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/partner/studio"
            className="text-sm font-medium text-[#2436BB] hover:underline"
          >
            ← Marketing Studio
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-zinc-950">Campaign History</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Review past campaigns, audiences, themes, and platforms.
          </p>
        </div>
        <Link
          href="/partner/studio/create"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96]"
        >
          Create Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
          No campaigns yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link
                href={`/partner/studio/campaigns/${c.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-[#2436BB]/40"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-zinc-900">{c.name}</p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {studioOptionLabel(STUDIO_THEMES, c.theme)} ·{" "}
                      {studioOptionLabel(STUDIO_AUDIENCES, c.audience)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {new Date(c.created_at).toLocaleString()} ·{" "}
                      {c.platforms.join(", ")}
                    </p>
                    <p className="mt-2 break-all text-xs text-zinc-500">
                      {c.referral_url}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                    <p className="font-semibold uppercase tracking-wide text-zinc-400">
                      Analytics
                    </p>
                    <p className="mt-1">Clicks: Coming Soon</p>
                    <p>Signups: Coming Soon</p>
                    <p>Qualified: Coming Soon</p>
                    <p>Revenue: Coming Soon</p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
