import {
  computeJobProtectionChecklist,
  type JobProtectionChecklistInput,
} from "@/lib/job-protection-checklist";

export function JobProtectionChecklist(props: JobProtectionChecklistInput) {
  const { items, percent, completedCount, totalCount } = computeJobProtectionChecklist(props);

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5"
      aria-labelledby="job-protection-checklist-heading"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="job-protection-checklist-heading" className="text-base font-semibold text-zinc-900">
            Job protection checklist
          </h2>
          <p className="mt-0.5 text-sm font-medium text-[#2436BB]">Protection score: {percent}%</p>
        </div>
        <p className="text-xs text-zinc-500">
          {completedCount} of {totalCount} complete
        </p>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                item.done ? "bg-green-100 text-green-800" : "border border-zinc-300 bg-white text-zinc-400"
              }`}
              aria-hidden
            >
              {item.done ? "✓" : ""}
            </span>
            <span className={item.done ? "text-zinc-600" : "font-medium text-zinc-900"}>{item.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-snug text-zinc-500">
        This score is a guide to help you document the job. It is not legal advice.
      </p>
    </section>
  );
}
