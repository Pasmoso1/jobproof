export function SourceTable({
  title,
  rows,
  labelHeader = "Source tuple",
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  labelHeader?: string;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      <ul className="mt-3 space-y-1 text-sm">
        {rows.length === 0 ? (
          <li className="text-zinc-500">No data yet</li>
        ) : (
          rows.slice(0, 20).map((r) => (
            <li key={r.label} className="text-zinc-700">
              <span className="text-zinc-500">{labelHeader}:</span> {r.label}{" "}
              <span className="font-medium">({r.count})</span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
