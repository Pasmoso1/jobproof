import { redirect } from "next/navigation";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import {
  buildPartnerReferralUrl,
  rewardAmountForLevel,
  partnerLevelLabel,
} from "@/lib/partners/constants";
import { resolveAppUrl } from "@/lib/stripe";
import {
  BRAND_GUIDELINES_ASSET,
  COMING_SOON_RESOURCES,
  EMAIL_SUBJECT_SUGGESTIONS,
  LOGO_USAGE_APPROVED,
  LOGO_USAGE_NOT_APPROVED,
  MEDIA_BRAND_ASSETS,
  MEDIA_CENTER_BRAND_COLORS,
  MEDIA_CENTER_MISSION,
  MEDIA_CENTER_NOTICE,
  MEDIA_CENTER_PERSONALITY,
  MEDIA_CENTER_POSITIONING,
  MEDIA_CONTACT,
  MEDIA_EMAIL_RESOURCES,
  MEDIA_PRINT_ASSETS,
  MEDIA_SOCIAL_ASSETS,
  MEDIA_WEBSITE_ASSETS,
  PARTNER_COPY_LIBRARY,
  buildMediaCenterFaqs,
  personalizePartnerCopy,
} from "@/lib/partners/media-center-content";
import { MediaSectionHeader } from "@/components/partners/media/media-section-header";
import { MediaAssetCard } from "@/components/partners/media/media-asset-card";
import { BrandColorSwatch } from "@/components/partners/media/brand-color-swatch";
import { GuidelinesList } from "@/components/partners/media/guidelines-list";
import { CopyContentCard } from "@/components/partners/media/copy-content-card";
import { ComingSoonResourceCard } from "@/components/partners/media/coming-soon-resource-card";
import { EmailResourceCard } from "@/components/partners/media/email-resource-card";
import { MediaFaq } from "@/components/partners/media/media-faq";

export default async function PartnerMediaCenterPage() {
  const session = await getActivePartnerForCurrentUser();
  if (!session) redirect("/login?next=/partner/media");

  const { partner } = session;
  const referralUrl = buildPartnerReferralUrl(
    resolveAppUrl(),
    partner.referral_code
  );
  const faqs = buildMediaCenterFaqs(partner.partner_level);
  const reward = rewardAmountForLevel(partner.partner_level);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(referralUrl)}`;

  return (
    <div className="space-y-14">
      <header className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#2436BB] via-[#4DBACC] to-[#F28C38]" />
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2436BB]">
              Partner Media Kit
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
              Partner Media Centre
            </h1>
            <p className="mt-2 text-base text-zinc-600">
              Production-ready JobProof brand assets, social graphics, email
              templates, and copy—ready to download and use.
            </p>
            <p className="mt-4 rounded-xl border border-[#2436BB]/20 bg-[#2436BB]/5 px-4 py-3 text-sm leading-relaxed text-zinc-700">
              {MEDIA_CENTER_NOTICE}
            </p>
            <p className="mt-3 text-sm text-zinc-500">
              Signed in as {partnerLevelLabel(partner.partner_level)} · ${reward}{" "}
              CAD per qualified referral
            </p>
          </div>
          <div className="flex w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-100 bg-[length:16px_16px] bg-[linear-gradient(45deg,#e4e4e7_25%,transparent_25%,transparent_75%,#e4e4e7_75%,#e4e4e7),linear-gradient(45deg,#e4e4e7_25%,#fafafa_25%,#fafafa_75%,#e4e4e7_75%,#e4e4e7)] bg-[position:0_0,8px_8px] p-5 sm:w-64">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/media-kit/logos/jobproof-primary-horizontal.png"
              alt="JobProof logo"
              className="h-auto max-h-20 w-full object-contain object-center sm:max-h-24"
            />
          </div>
        </div>
      </header>

      <section>
        <MediaSectionHeader
          title="Brand Assets"
          description="Approved JobProof logos, icons, and favicons. Download PNG files ready for immediate use."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MEDIA_BRAND_ASSETS.map((asset) => (
            <MediaAssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      </section>

      <section>
        <MediaSectionHeader
          title="Brand Guidelines"
          description="Logo usage, spacing, colour palette, backgrounds, typography, and tone of voice."
        />
        <div className="space-y-4">
          <MediaAssetCard asset={BRAND_GUIDELINES_ASSET} />

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Mission
            </h3>
            <p className="mt-2 text-base font-medium text-zinc-900">
              {MEDIA_CENTER_MISSION}
            </p>
            <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Positioning
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              {MEDIA_CENTER_POSITIONING}
            </p>
            <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Brand personality
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {MEDIA_CENTER_PERSONALITY.map((trait) => (
                <span
                  key={trait}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700"
                >
                  {trait}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-base font-semibold text-zinc-900">
              Brand colours
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MEDIA_CENTER_BRAND_COLORS.map((color) => (
                <BrandColorSwatch
                  key={color.hex}
                  name={color.name}
                  hex={color.hex}
                  note={color.note}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GuidelinesList
              title="Logo usage — approved"
              items={LOGO_USAGE_APPROVED}
              variant="approved"
            />
            <GuidelinesList
              title="Logo usage — not approved"
              items={LOGO_USAGE_NOT_APPROVED}
              variant="not-approved"
            />
          </div>
        </div>
      </section>

      <section>
        <MediaSectionHeader
          title="Social Media Kit"
          description="High-resolution graphics using the real JobProof logo and current product messaging."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MEDIA_SOCIAL_ASSETS.map((asset) => (
            <MediaAssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      </section>

      <section>
        <MediaSectionHeader
          title="Email Resources"
          description={
            referralUrl
              ? "Templates include your personal referral link where noted."
              : "Templates include a [PARTNER LINK] placeholder until your referral URL is available."
          }
        />
        <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900">
            Subject line suggestions
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {EMAIL_SUBJECT_SUGGESTIONS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <a
            href="/media-kit/email/subject-line-suggestions.txt"
            download="subject-line-suggestions.txt"
            className="mt-3 inline-flex text-sm font-semibold text-[#2436BB] hover:underline"
          >
            Download subject lines
          </a>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {MEDIA_EMAIL_RESOURCES.map((resource) => (
            <EmailResourceCard
              key={resource.id}
              title={resource.title}
              description={resource.description}
              textBody={personalizePartnerCopy(resource.textBody, referralUrl)}
              htmlHref={resource.htmlHref}
              htmlFileName={resource.htmlFileName}
              subjects={resource.subjects}
            />
          ))}
        </div>
      </section>

      <section>
        <MediaSectionHeader
          title="Website Resources"
          description="Banners with the real JobProof logo and a clear call to action."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MEDIA_WEBSITE_ASSETS.map((asset) => (
            <MediaAssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      </section>

      <section>
        <MediaSectionHeader
          title="Print Resources"
          description="Print-ready PDFs at 300 DPI, plus high-resolution PNG previews."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MEDIA_PRINT_ASSETS.map((asset) => (
            <MediaAssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      </section>

      <section>
        <MediaSectionHeader
          title="Partner Copy Library"
          description={
            referralUrl
              ? "Copyable text blocks with your referral link already filled in."
              : "Copyable text blocks. [PARTNER LINK] is replaced when your referral URL is available."
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PARTNER_COPY_LIBRARY.map((block) => (
            <CopyContentCard
              key={block.id}
              title={block.title}
              intendedUse={block.intendedUse}
              body={personalizePartnerCopy(block.body, referralUrl)}
            />
          ))}
        </div>
      </section>

      <section>
        <MediaSectionHeader
          title="Partner QR code"
          description="Scan or download a QR graphic for your personal referral link."
        />
        {referralUrl ? (
          <article className="max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex justify-center rounded-xl border border-zinc-100 bg-zinc-50 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSrc}
                alt="QR code for your JobProof partner referral link"
                width={160}
                height={160}
                className="h-40 w-40"
              />
            </div>
            <a
              href={qrSrc}
              download="jobproof-partner-referral-qr.png"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2436BB] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1c2a96]"
            >
              Open QR image
            </a>
          </article>
        ) : (
          <ComingSoonResourceCard
            title="Partner QR code"
            description="Available once your referral URL is ready."
          />
        )}
      </section>

      {COMING_SOON_RESOURCES.length > 0 ? (
        <section>
          <MediaSectionHeader
            title="Coming soon"
            description="Assets that do not have production files yet."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {COMING_SOON_RESOURCES.map((resource) => (
              <ComingSoonResourceCard
                key={resource.id}
                title={resource.title}
                description={resource.description}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <MediaSectionHeader title="FAQ" />
        <MediaFaq items={faqs} />
      </section>

      <section
        aria-labelledby="contact-heading"
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <h2 id="contact-heading" className="text-xl font-bold text-zinc-950">
          {MEDIA_CONTACT.heading}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          {MEDIA_CONTACT.body}
        </p>
        <a
          href={`mailto:${MEDIA_CONTACT.email}`}
          className="mt-4 inline-flex text-sm font-semibold text-[#2436BB] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
        >
          {MEDIA_CONTACT.email}
        </a>
      </section>
    </div>
  );
}
