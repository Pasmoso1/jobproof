import type { EmailLog } from "@/types/database";
import { formatDateTimeEastern } from "@/lib/datetime-eastern";

export function RecentEmailActivity({ logs }: { logs: EmailLog[] }) {
  return (
    <section className="mt-10 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Recent email delivery</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Logged sends for contract, change order, and invoice emails (success and failure). Use this
        to debug delivery issues.
      </p>

      {logs.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No entries yet. After you send signing links or signed documents, attempts appear here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100">
          {logs.map((row) => (
            <li key={row.id} className="py-3 text-sm first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    row.status === "success"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {row.status}
                </span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                  {row.type.replace("_", " ")}
                </span>
                <span className="text-zinc-500">
                  {formatDateTimeEastern(row.created_at)}
                </span>
              </div>
              <p className="mt-1 font-medium text-zinc-900">{row.recipient_email}</p>
              {row.related_entity_id && (
                <p className="mt-0.5 font-mono text-xs text-zinc-500">
                  Related id: {row.related_entity_id}
                </p>
              )}
              {row.status === "failed" && row.error_message && (
                <p className="mt-1 text-xs text-red-700">{row.error_message}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
