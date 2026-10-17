import Link from "next/link";
import type { FollowUpAccount } from "@/lib/admin/overview-data";
import { PAST_DUE_ANCHOR, TRIALS_ENDING_ANCHOR } from "@/lib/admin/overview-metrics";

function AccountList({
  id,
  title,
  total,
  accounts,
  empty,
}: {
  id: string;
  title: string;
  /** Total matching accounts; may exceed the rows displayed. */
  total: number;
  accounts: FollowUpAccount[];
  empty: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-20 rounded-lg border border-zinc-200 bg-white p-4 sm:p-5"
    >
      <h3 id={`${id}-heading`} className="text-base font-semibold text-zinc-900">
        {title}
      </h3>
      {accounts.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{empty}</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-zinc-100">
            {accounts.map((a) => (
              <li key={a.profileId} className="py-3 text-sm">
                <Link
                  href={`/admin/users/${a.profileId}`}
                  className="font-medium text-[#2436BB] underline decoration-[#2436BB]/40 underline-offset-2 hover:decoration-[#2436BB]"
                >
                  {a.email}
                </Link>
                <p className="text-zinc-600">{a.business}</p>
                <p className="text-xs text-zinc-500">{a.detail}</p>
              </li>
            ))}
          </ul>
          {total > accounts.length ? (
            <p className="mt-2 text-xs text-zinc-500">
              Showing {accounts.length} of {total.toLocaleString("en-CA")}.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Drill-down targets for the alert cards; each row links to the contractor detail page. */
export function AccountFollowUp({
  pastDue,
  pastDueTotal,
  trialsEnding,
  trialsEndingTotal,
}: {
  pastDue: FollowUpAccount[];
  pastDueTotal: number;
  trialsEnding: FollowUpAccount[];
  trialsEndingTotal: number;
}) {
  return (
    <section aria-label="Accounts to follow up" className="grid gap-4 lg:grid-cols-2">
      <AccountList
        id={PAST_DUE_ANCHOR}
        title="Past-due subscriptions"
        total={pastDueTotal}
        accounts={pastDue}
        empty="No past-due subscriptions."
      />
      <AccountList
        id={TRIALS_ENDING_ANCHOR}
        title="Trials ending soon"
        total={trialsEndingTotal}
        accounts={trialsEnding}
        empty="No managed trials end in the next few days."
      />
    </section>
  );
}
