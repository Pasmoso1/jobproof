/**
 * LinkedIn social graphic layout constants (1200×627).
 * Shared by the media-kit builder and regression tests.
 *
 * Landscape LinkedIn is shorter than square social templates, so the headline
 * must be placed below the rendered logo rather than at a fixed height fraction.
 *
 * Note: SVG <text y> is the baseline. Headline placement must reserve font ascent
 * so the visible glyphs clear the logo box.
 */

export const LINKEDIN_SOCIAL_LAYOUT = {
  width: 1200,
  height: 627,
  fileName: "jobproof-linkedin-1200x627.png",
  publicPath: "/media-kit/social/jobproof-linkedin-1200x627.png",
  logoTop: 40,
  logoLeft: 48,
  logoWidth: 380,
  /**
   * Clear space between logo bottom and the top of the first headline glyphs
   * (not the SVG baseline).
   */
  logoHeadlineGap: 40,
  headlineFontSize: 56,
  headlineLineHeight: 1.15,
  /** Approximate Arial-bold ascent as a fraction of font-size. */
  headlineAscentRatio: 0.8,
  headlineLines: [
    "The contractor platform",
    "for growth and protection.",
  ],
  subhead: "Quotes · Contracts · Change Orders · Invoices · Documentation",
  subheadGap: 24,
  subheadFontSize: 26,
  ctaBottomOffset: 90,
};

export function linkedinHeadlineAscent() {
  return Math.round(
    LINKEDIN_SOCIAL_LAYOUT.headlineFontSize *
      LINKEDIN_SOCIAL_LAYOUT.headlineAscentRatio
  );
}

/** Bottom edge of the logo box (exclusive of gap). */
export function linkedinLogoBottom(logoRenderedHeight) {
  return LINKEDIN_SOCIAL_LAYOUT.logoTop + logoRenderedHeight;
}

/**
 * Top of the first headline glyphs (approx), given rendered logo height.
 */
export function linkedinHeadlineTop(logoRenderedHeight) {
  return (
    linkedinLogoBottom(logoRenderedHeight) +
    LINKEDIN_SOCIAL_LAYOUT.logoHeadlineGap
  );
}

/**
 * SVG text baseline Y for the first headline line.
 */
export function linkedinHeadlineY(logoRenderedHeight) {
  return linkedinHeadlineTop(logoRenderedHeight) + linkedinHeadlineAscent();
}
