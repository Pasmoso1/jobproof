import type { Metadata } from "next";
import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";
import { StudioIcon } from "@/components/partners/studio/studio-icon";
import { OrganizationIconCard } from "@/components/partners/organization-partner-callout";
import {
  ORGANIZATION_AUDIENCE_CARDS,
  ORGANIZATION_COMPARISON,
  ORGANIZATION_FAQS,
  ORGANIZATION_FINAL_CTA,
  ORGANIZATION_HOW_STEPS,
  ORGANIZATION_MARKETING_SUPPORT,
  ORGANIZATION_PARTNERS_HERO,
  ORGANIZATION_PARTNERS_META,
  ORGANIZATION_PROMOTE_WAYS,
  ORGANIZATION_WHY_CARDS,
} from "@/lib/partners/content/organizations";

export const metadata: Metadata = {
  title: ORGANIZATION_PARTNERS_META.title,
  description: ORGANIZATION_PARTNERS_META.description,
};

export default function OrganizationPartnersPage() {
  const hero = ORGANIZATION_PARTNERS_HERO;

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-200 px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link href="/">
            <JobProofLogo />
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-3 text-sm sm:gap-4">
            <Link
              href="/partners"
              className="font-medium text-zinc-600 hover:text-zinc-900"
            >
              Partner Program
            </Link>
            <Link
              href="/partners/organizations/apply"
              className="font-medium text-[#2436BB] hover:text-[#1c2a96]"
            >
              Apply
            </Link>
            <Link
              href="/login"
              className="font-medium text-zinc-600 hover:text-zinc-900"
            >
              Partner sign in
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-white px-6 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#2436BB]">
              {hero.eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
              {hero.headline}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-zinc-600">
              {hero.subtitle}
            </p>
            <p className="mt-4 text-base leading-relaxed text-zinc-600">
              {hero.supporting}
            </p>
            <ul className="mx-auto mt-8 grid max-w-2xl gap-2 text-left text-sm text-zinc-800 sm:grid-cols-2">
              {hero.memberBenefits.map((item) => (
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
                href={hero.primaryCta.href}
                className="inline-flex rounded-xl bg-[#2436BB] px-6 py-3.5 text-base font-semibold text-white hover:bg-[#1c2a96]"
              >
                {hero.primaryCta.label}
              </Link>
            </div>
          </div>
        </section>

        {/* Why organizations partner */}
        <section className="border-b border-zinc-200 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-2xl font-bold text-zinc-950 sm:text-3xl">
                Why organizations partner with JobProof
              </h2>
              <p className="mt-3 text-zinc-600">
                Create member value, open a new revenue stream, and promote a
                platform contractors use to win work and run stronger businesses.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ORGANIZATION_WHY_CARDS.map((card) => (
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

        {/* Who this is for */}
        <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-2xl font-bold text-zinc-950 sm:text-3xl">
                Who this is for
              </h2>
              <p className="mt-3 text-zinc-600">
                Built for organizations that recommend services and tools to
                contractors and small construction businesses.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ORGANIZATION_AUDIENCE_CARDS.map((card) => (
                <article
                  key={card.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <p className="flex items-start gap-2 text-base font-semibold text-zinc-900">
                    <span className="text-[#2436BB]" aria-hidden>
                      ✔
                    </span>
                    <span>{card.title}</span>
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    {card.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-zinc-200 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-2xl font-bold text-zinc-950 sm:text-3xl">
              How it works
            </h2>
            <ol className="mt-10 space-y-0">
              {ORGANIZATION_HOW_STEPS.map((step, index) => (
                <li key={step.step} className="relative flex gap-4 pb-8 last:pb-0">
                  {index < ORGANIZATION_HOW_STEPS.length - 1 ? (
                    <span
                      className="absolute left-4 top-10 h-[calc(100%-2rem)] w-px bg-zinc-200"
                      aria-hidden
                    />
                  ) : null}
                  <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2436BB] text-sm font-semibold text-white">
                    {step.step}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-lg font-semibold text-zinc-900">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                      {step.body}
                    </p>
                    {index < ORGANIZATION_HOW_STEPS.length - 1 ? (
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        ↓
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Ways to promote */}
        <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-zinc-950 sm:text-3xl">
              Ways to promote JobProof
            </h2>
            <p className="mt-3 text-zinc-600">
              Use the channels your members already trust—JobProof supplies the
              assets.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {ORGANIZATION_PROMOTE_WAYS.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 shadow-sm"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2436BB]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Member benefits comparison */}
        <section className="border-b border-zinc-200 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-2xl font-bold text-zinc-950 sm:text-3xl">
                Member benefits
              </h2>
              <p className="mt-3 text-zinc-600">
                JobProof helps members win more jobs, run professional workflows,
                stay organized, and grow—protection is one benefit, not the whole
                story.
              </p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Without JobProof
                </h3>
                <ul className="mt-4 space-y-3 text-sm text-zinc-700">
                  {ORGANIZATION_COMPARISON.without.map((item) => (
                    <li key={item} className="flex gap-3">
                      <StudioIcon
                        name="minus"
                        className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border-2 border-[#2436BB] bg-[#2436BB]/5 p-6">
                <h3 className="text-lg font-semibold text-zinc-900">
                  With JobProof
                </h3>
                <ul className="mt-4 space-y-3 text-sm text-zinc-800">
                  {ORGANIZATION_COMPARISON.with.map((item) => (
                    <li key={item} className="flex gap-3">
                      <StudioIcon
                        name="check"
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#2436BB]"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Marketing support */}
        <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-2xl font-bold text-zinc-950 sm:text-3xl">
                Marketing support
              </h2>
              <p className="mt-3 text-zinc-600">
                Organization partners receive the same production-ready tools as
                the Partner Portal—ready for newsletters, events, and member
                outreach.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ORGANIZATION_MARKETING_SUPPORT.map((card) => (
                <OrganizationIconCard
                  key={card.id}
                  icon={card.icon}
                  title={card.title}
                  body={card.body}
                />
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-zinc-500">
              Media Centre and Marketing Studio are available after your
              organization is approved and signed in to the Partner Portal.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-14 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-zinc-950 sm:text-3xl">FAQ</h2>
            <dl className="mt-8 space-y-6">
              {ORGANIZATION_FAQS.map((faq) => (
                <div key={faq.question}>
                  <dt className="font-semibold text-zinc-900">{faq.question}</dt>
                  <dd className="mt-1 text-zinc-600">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 py-16 sm:px-8">
          <div className="mx-auto max-w-3xl rounded-2xl bg-zinc-950 px-8 py-12 text-center text-white">
            <h2 className="text-2xl font-bold sm:text-3xl">
              {ORGANIZATION_FINAL_CTA.headline}
            </h2>
            <p className="mt-3 text-zinc-300">
              Help members win more work, operate more professionally, and grow—while
              creating a simple referral opportunity for your organization.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={ORGANIZATION_FINAL_CTA.primaryCta.href}
                className="inline-flex rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-zinc-950 hover:bg-zinc-100"
              >
                {ORGANIZATION_FINAL_CTA.primaryCta.label}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 px-6 py-8 text-center text-sm text-zinc-500">
        <div className="flex flex-wrap justify-center gap-5">
          <Link href="/partners" className="hover:text-zinc-800">
            ← Partner Program
          </Link>
          <Link href="/partners/agreement" className="hover:text-zinc-800">
            Partner Program Agreement
          </Link>
          <Link href="/" className="hover:text-zinc-800">
            Back to JobProof
          </Link>
        </div>
      </footer>
    </div>
  );
}
