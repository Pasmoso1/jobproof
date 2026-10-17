import Link from "next/link";
import { formatAdminDateTime } from "@/lib/admin/product-usage";

export type NeedsPanelRow = {
  profileId: string;
  email: string;
  business: string;
  created: string;
  last: string | null;
};

/** Funnel drop-off list; every row links to that contractor's admin detail page. */
export function NeedsPanel({ title, rows }: { title: string; rows: NeedsPanelRow[] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      <ul className="mt-3 divide-y divide-zinc-100">
        {rows.length === 0 ? (
          <li className="py-3 text-sm text-zinc-500">None</li>
        ) : (
          rows.map((r) => (
            <li key={`${title}-${r.profileId}`} className="py-3 text-sm">
              <Link
                href={`/admin/users/${r.profileId}`}
                className="font-medium text-[#2436BB] underline decoration-[#2436BB]/40 underline-offset-2 hover:decoration-[#2436BB]"
              >
                {r.email}
              </Link>
              <p className="text-zinc-600">{r.business}</p>
              <p className="text-xs text-zinc-500">
                Created {formatAdminDateTime(r.created)} • Last activity{" "}
                {formatAdminDateTime(r.last)}
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
