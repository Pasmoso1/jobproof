import Link from "next/link";
import { StudioIcon } from "@/components/partners/studio/studio-icon";
import { ORGANIZATION_PORTAL_CALLOUT } from "@/lib/partners/content/organizations";

/** Compact callout linking portal pages to the public Organization Partners program. */
export function OrganizationPartnerCallout({
  className = "",
}: {
  className?: string;
}) {
  return (
    <aside
      className={`rounded-xl border border-[#2436BB]/20 bg-[#2436BB]/5 px-4 py-3 text-sm leading-relaxed text-zinc-700 ${className}`}
    >
      <p>
        Represent an association or organization?{" "}
        <Link
          href={ORGANIZATION_PORTAL_CALLOUT.href}
          className="font-semibold text-[#2436BB] hover:text-[#1c2a96] hover:underline"
        >
          {ORGANIZATION_PORTAL_CALLOUT.linkLabel}
        </Link>
      </p>
    </aside>
  );
}

export function OrganizationIconCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2436BB]/10 text-[#2436BB]">
        <StudioIcon name={icon} className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-zinc-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{body}</p>
    </article>
  );
}
