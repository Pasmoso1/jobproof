export function FoundingPartnerBadge({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-[#2436BB]/25 bg-[#2436BB]/5 px-2.5 py-1 text-xs font-semibold text-[#2436BB] ${className}`}
    >
      Founding Partner
    </span>
  );
}
