/**
 * LinkedIn social graphic layout constants (1200×627).
 * Media Kit v2: LinkedIn exports live under campaign folders.
 * A compatibility copy also ships at the legacy root path during Wave 1.
 */

export const LINKEDIN_SOCIAL_LAYOUT = {
  width: 1200,
  height: 627,
  fileName: "jobproof-win-more-work-linkedin.png",
  publicPath:
    "/media-kit/social/win-more-work/jobproof-win-more-work-linkedin.png",
  legacyPublicPath: "/media-kit/social/jobproof-linkedin-1200x627.png",
  logoTop: 36,
  logoLeft: 48,
  logoWidth: 320,
  logoHeadlineGap: 36,
  headlineFontSize: 44,
  headlineLineHeight: 1.12,
  headlineAscentRatio: 0.8,
  headlineLines: ["Win more work."],
  subhead: "From quote request to signed job.",
  subheadGap: 18,
  subheadFontSize: 22,
  ctaBottomOffset: 88,
};

export function linkedinHeadlineAscent() {
  return Math.round(
    LINKEDIN_SOCIAL_LAYOUT.headlineFontSize *
      LINKEDIN_SOCIAL_LAYOUT.headlineAscentRatio
  );
}

export function linkedinLogoBottom(logoRenderedHeight) {
  return LINKEDIN_SOCIAL_LAYOUT.logoTop + logoRenderedHeight;
}

export function linkedinHeadlineTop(logoRenderedHeight) {
  return (
    linkedinLogoBottom(logoRenderedHeight) +
    LINKEDIN_SOCIAL_LAYOUT.logoHeadlineGap
  );
}

export function linkedinHeadlineY(logoRenderedHeight) {
  return linkedinHeadlineTop(logoRenderedHeight) + linkedinHeadlineAscent();
}
