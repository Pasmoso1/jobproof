export function GuidelinesList({
  title,
  items,
  variant = "approved",
}: {
  title: string;
  items: readonly string[];
  variant?: "approved" | "not-approved";
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-zinc-700">
            <span
              className={
                variant === "approved" ? "text-green-700" : "text-red-700"
              }
              aria-hidden="true"
            >
              {variant === "approved" ? "✓" : "×"}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
