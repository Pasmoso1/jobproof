import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobProofLogo } from "@/components/jobproof-logo";
import { StudioIcon } from "@/components/partners/studio/studio-icon";
import { OrganizationIconCard } from "@/components/partners/organization-partner-callout";
import {
  getOrganizationLandingVariant,
  getSharedOrganizationLandingContent,
  ORGANIZATION_LANDING_SLUGS,
  type OrganizationLandingSlug,
} from "@/lib/partners/content/organization-landing-pages";
import { PARTNER_PROGRAM_LOGIN_HREF } from "@/lib/partners/login-href";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return ORGANIZATION_LANDING_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const variant = getOrganizationLandingVariant(slug);
  if (!variant) return { title: "Organization Partners | JobProof" };
  return {
    title: variant.metaTitle,
    description: variant.metaDescription,
  };
}

export default async function OrganizationLandingVariantPage({
  params,
}: PageProps) {
  const { slug } = await params;
  const variant = getOrganizationLandingVariant(slug);
  if (!variant) notFound();

  const shared = getSharedOrganizationLandingContent();

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-200 px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link href="/">
            <JobProofLogo />
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-3 text-sm sm:gap-4">
            <Link
              href="/partners/organizations"
              className="font-medium text-zinc-600 hover:text-zinc-900"
            >
              Organization Partners
            </Link>
            <Link
              href="/partners/organizations/apply"
              className="font-medium text-[#2436BB] hover:text-[#1c2a96]"
            >
              Apply
            </Link>
            <Link
              href={PARTNER_PROGRAM_LOGIN_HREF}
              className="font-medium text-zinc-600 hover:text-zinc-900"
            >
              Partner sign in
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-white px-6 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#2436BB]">
              {variant.hero.eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
              {variant.hero.headline}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-zinc-600">
              {variant.hero.subtitle}
            </p>
            <p className="mt-4 text-base leading-relaxed text-zinc-600">
              {variant.hero.supporting}
            </p>
            <ul className="mx-auto mt-8 grid max-w-2xl gap-2 text-left text-sm text-zinc-800 sm:grid-cols-2">
              {shared.memberBenefits.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="font-semibold text-[#2436BB]" aria-hidden>
                    •
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={shared.primaryCta.href}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2436BB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96]"
              >
                {shared.primaryCta.label}
              </Link>
            </div>
            <p className="mt-6 text-xs text-zinc-500">{variant.hero.photographyNote}</p>
          </div>
        </section>

        <section className="border-b border-zinc-200 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold text-zinc-950">Industry examples</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {variant.industryExamples.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold text-zinc-950">Member examples</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {variant.memberExamples.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-200 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold text-zinc-950">Marketing examples</h2>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {variant.marketingExamples.map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold text-zinc-950">Why partner with JobProof</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shared.whyCards.map((card) => (
                <OrganizationIconCard
                  key={card.id}
                  icon={card.icon}
                  title={card.title}
                  body={card.body}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-200 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold text-zinc-950">How it works</h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-2">
              {shared.howSteps.map((step) => (
                <li
                  key={step.step}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#2436BB]">
                    Step {step.step}
                  </p>
                  <h3 className="mt-2 font-semibold text-zinc-900">{step.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold text-zinc-950">Marketing support</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shared.marketingSupport.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <StudioIcon name={item.icon} className="h-5 w-5 text-[#2436BB]" />
                    <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-200 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-zinc-950">FAQ</h2>
            <div className="mt-6 space-y-4">
              {shared.faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <summary className="cursor-pointer font-semibold text-zinc-900">
                    {faq.question}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-16 sm:px-8">
          <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-gradient-to-br from-[#2436BB]/5 to-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-zinc-950">
              {shared.finalCta.headline}
            </h2>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={shared.finalCta.primaryCta.href}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2436BB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2a96]"
              >
                {shared.finalCta.primaryCta.label}
              </Link>
            </div>
            <p className="mt-6 text-xs text-zinc-500">
              More organization pages:{" "}
              {ORGANIZATION_LANDING_SLUGS.filter(
                (s) => s !== (variant.slug as OrganizationLandingSlug)
              )
                .slice(0, 4)
                .map((s, i) => (
                  <span key={s}>
                    {i > 0 ? " · " : null}
                    <Link
                      href={`/partners/organizations/${s}`}
                      className="font-medium text-[#2436BB] hover:underline"
                    >
                      {s}
                    </Link>
                  </span>
                ))}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
