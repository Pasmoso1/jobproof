import Image from "next/image";
import { redirect } from "next/navigation";
import { getActivePartnerForCurrentUser } from "@/lib/partners/session";
import {
  buildPartnerReferralUrl,
  rewardAmountForLevel,
  partnerLevelLabel,
} from "@/lib/partners/constants";
import { resolveAppUrl } from "@/lib/stripe";
import {
  ABOUT_JOBPROOF_BLOCKS,
  COMING_SOON_RESOURCES,
  LOGO_USAGE_APPROVED,
  LOGO_USAGE_NOT_APPROVED,
  MEDIA_BRAND_ASSETS,
  MEDIA_CENTER_BRAND_COLORS,
  MEDIA_CENTER_MISSION,
  MEDIA_CENTER_NOTICE,
  MEDIA_CENTER_PERSONALITY,
  MEDIA_CENTER_POSITIONING,
  MEDIA_CONTACT,
  NEWSLETTER_BLOCKS,
  NEWSLETTER_FEATURE_ARTICLE,
  QUICK_PITCH_BLOCKS,
  SOCIAL_CAPTION_BLOCKS,
  buildMediaCenterFaqs,
  personalizePartnerCopy,
} from "@/lib/partners/media-center-content";
import { MediaSectionHeader } from "@/components/partners/media/media-section-header";
import { MediaAssetCard } from "@/components/partners/media/media-asset-card";
import { BrandColorSwatch } from "@/components/partners/media/brand-color-swatch";
import { GuidelinesList } from "@/components/partners/media/guidelines-list";
import { CopyContentCard } from "@/components/partners/media/copy-content-card";
import { SocialCaptionCard } from "@/components/partners/media/social-caption-card";
import { ComingSoonResourceCard } from "@/components/partners/media/coming-soon-resource-card";
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
    <div className="space-y-12">
      <header className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
              Partner Media Center
            </h1>
            <p className="mt-2 text-base text-zinc-600">
              Everything you need to promote JobProof accurately and professionally.
            </p>
            <p className="mt-4 rounded-xl border border-[#2436BB]/20 bg-[#2436BB]/5 px-4 py-3 text-sm leading-relaxed text-zinc-700">
              {MEDIA_CENTER_NOTICE}
            </p>
            <p className="mt-3 text-sm text-zinc-500">
              Signed in as {partnerLevelLabel(partner.partner_level)} · ${reward}{" "}
              CAD per qualified referral
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-center rounded-xl border border-zinc-100 bg-zinc-50 p-4">
            <Image
              src="/media-kit/logos/jobproof-primary-horizontal.png"
              alt="JobProof logo"
              width={220}
              height={66}
              className="h-auto w-44 object-contain sm:w-52"
              priority
            />
          </div>
        </div>
      </header>

      <section>
        <MediaSectionHeader
          title="Brand assets"
          description="Download approved JobProof logos, icons, and favicons."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MEDIA_BRAND_ASSETS.map((asset) => (
            <MediaAssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      </section>

      <section>
        <MediaSectionHeader title="Brand guidelines" />
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
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
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700"
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

          <div className="grid gap-4 sm:grid-cols-2">
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
          title="About JobProof"
          description="Approved company descriptions you can copy into partner materials."
        />
        <div className="grid gap-4 lg:grid-cols-1">
          {ABOUT_JOBPROOF_BLOCKS.map((block) => (
            <CopyContentCard
              key={block.id}
              title={block.title}
              intendedUse={block.intendedUse}
              body={block.body}
            />
          ))}
        </div>
      </section>

      <section>
        <MediaSectionHeader title="Quick pitches" />
        <div className="grid gap-4 sm:grid-cols-2">
          {QUICK_PITCH_BLOCKS.map((block) => (
            <CopyContentCard
              key={block.id}
              title={block.title}
              intendedUse={block.intendedUse}
              body={block.body}
            />
          ))}
        </div>
      </section>

      <section>
        <MediaSectionHeader
          title="Social media captions"
          description={
            referralUrl
              ? "Captions include your personal referral link."
              : "Captions include a partner-link placeholder until your referral URL is available."
          }
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {SOCIAL_CAPTION_BLOCKS.map((block) => (
            <SocialCaptionCard
              key={block.id}
              title={block.title}
              intendedUse={block.intendedUse}
              body={personalizePartnerCopy(block.body, referralUrl)}
              referralUrl={referralUrl}
            />
          ))}
        </div>
      </section>

      <section>
        <MediaSectionHeader title="Newsletter content" />
        <div className="space-y-4">
          {NEWSLETTER_BLOCKS.map((block) => (
            <CopyContentCard
              key={block.id}
              title={block.title}
              intendedUse={block.intendedUse}
              body={block.body}
            />
          ))}
          <CopyContentCard
            title={NEWSLETTER_FEATURE_ARTICLE.title}
            intendedUse={NEWSLETTER_FEATURE_ARTICLE.intendedUse}
            body={personalizePartnerCopy(
              NEWSLETTER_FEATURE_ARTICLE.body,
              referralUrl
            )}
          />
        </div>
      </section>

      <section>
        <MediaSectionHeader
          title="More partner resources"
          description="Additional marketing downloads planned for a future update."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMING_SOON_RESOURCES.map((resource) => {
            if (resource.id === "partner-qr" && referralUrl) {
              return (
                <article
                  key={resource.id}
                  className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="text-base font-semibold text-zinc-900">
                    Partner QR code
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    Scan or download a QR graphic for your personal referral link.
                  </p>
                  <div className="mt-4 flex justify-center rounded-lg border border-zinc-100 bg-zinc-50 p-3">
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
                    className="mt-4 inline-flex rounded-lg bg-[#2436BB] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1c2a96]"
                  >
                    Open QR image
                  </a>
                </article>
              );
            }
            return (
              <ComingSoonResourceCard
                key={resource.id}
                title={resource.title}
                description={resource.description}
              />
            );
          })}
        </div>
      </section>

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
