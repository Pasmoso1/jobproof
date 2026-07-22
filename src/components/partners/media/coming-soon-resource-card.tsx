export function ComingSoonResourceCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 text-sm text-zinc-600">{description}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Coming soon
      </p>
    </article>
  );
}
