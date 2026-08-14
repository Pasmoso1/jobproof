import {
  MARKETING_PARTNER_POLICY,
  PARTNER_RESOURCES,
  PARTNER_RESOURCE_CATEGORY_LABELS,
  type PartnerResource,
} from "@/lib/partners/content/resources";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import { isMarketingPartnerType } from "@/lib/partners/constants";
import { OrganizationPartnerCallout } from "@/components/partners/organization-partner-callout";

export default async function PartnerResourcesPage() {
  const session = await getActivePartnerForCurrentUser();
  const highlightPolicy = isMarketingPartnerType(session?.partner.partner_type);
  const byCategory = PARTNER_RESOURCES.reduce(
    (acc, r) => {
      (acc[r.category] ??= []).push(r);
      return acc;
    },
    {} as Record<PartnerResource["category"], PartnerResource[]>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Marketing resources</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Brand assets and templates for partner promotions. Download production-ready
          files from the Media Centre whenever possible.
        </p>
        <OrganizationPartnerCallout className="mt-4" />
      </div>

      <section
        className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${
          highlightPolicy
            ? "border-[#2436BB]/30 bg-[#2436BB]/5"
            : "border-zinc-200 bg-white"
        }`}
      >
        <h2 className="text-lg font-semibold text-zinc-900">
          {MARKETING_PARTNER_POLICY.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          {MARKETING_PARTNER_POLICY.intro}
        </p>
        <p className="mt-3 text-sm font-medium text-zinc-800">
          Marketing Partners must not:
        </p>
        <ul className="mt-2 grid gap-1.5 text-sm text-zinc-700 sm:grid-cols-2">
          {MARKETING_PARTNER_POLICY.mustNot.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-[#2436BB]" aria-hidden>
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-zinc-600">
          {MARKETING_PARTNER_POLICY.closing}
        </p>
      </section>

      {Object.entries(byCategory).map(([category, items]) => (
        <section key={category} className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">
            {PARTNER_RESOURCE_CATEGORY_LABELS[category as PartnerResource["category"]]}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <p className="font-medium text-zinc-900">{item.title}</p>
                <p className="mt-1 text-sm text-zinc-600">{item.description}</p>
                {item.href ? (
                  <a
                    href={item.href}
                    className="mt-3 inline-block text-sm font-medium text-[#2436BB] hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download
                  </a>
                ) : (
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Coming soon
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
