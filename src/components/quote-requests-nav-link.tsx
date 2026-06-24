import Link from "next/link";

export function QuoteRequestsNavLink({ newCount }: { newCount: number }) {
  return (
    <Link
      href="/quote-requests"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900"
    >
      <span>Quote Requests</span>
      {newCount > 0 ? (
        <span
          className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold leading-none text-white"
          aria-label={`${newCount} new quote requests`}
        >
          {newCount > 99 ? "99+" : newCount}
        </span>
      ) : null}
    </Link>
  );
}
