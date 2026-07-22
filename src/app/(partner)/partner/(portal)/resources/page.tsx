import {
  PARTNER_RESOURCES,
  PARTNER_RESOURCE_CATEGORY_LABELS,
  type PartnerResource,
} from "@/lib/partners/content/resources";

export default function PartnerResourcesPage() {
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
          Brand assets and templates for partner promotions. Additional files can be added over
          time without changing the portal structure.
        </p>
      </div>

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
