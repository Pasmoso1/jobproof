export function MediaSectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 border-b border-zinc-200 pb-4">
      <h2 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-zinc-600">
          {description}
        </p>
      ) : null}
    </div>
  );
}
