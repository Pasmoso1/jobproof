import Link from "next/link";
import { getCollectionsCenterData } from "@/lib/collections-center-server";
import { CollectionsFollowUpClient } from "./collections-follow-up-client";

export default async function CollectionsPage() {
  const data = await getCollectionsCenterData();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 sm:text-3xl">Collections</h1>
        <p className="mt-1 text-sm text-zinc-600 sm:text-base">
          Follow up on open invoices in one place — who to nudge, who has viewed the invoice, and when you
          last reminded them.
        </p>
      </div>

      <CollectionsFollowUpClient data={data} />
    </div>
  );
}
