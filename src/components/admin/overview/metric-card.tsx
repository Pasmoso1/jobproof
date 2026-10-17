import type { MetricCount } from "@/lib/admin/overview-metrics";

export function formatMetric(count: MetricCount): string {
  return count.ok ? count.value.toLocaleString("en-CA") : "Unavailable";
}

export function MetricCard({
  label,
  count,
  hint,
}: {
  label: string;
  count: MetricCount;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={`mt-2 font-semibold ${
          count.ok ? "text-2xl text-zinc-900" : "text-base text-zinc-400"
        }`}
      >
        {formatMetric(count)}
      </p>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-zinc-500">{hint}</p> : null}
    </div>
  );
}
