"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  GA4_FUNNEL_EVENTS,
  buildAcquisitionContext,
  trackGa4Event,
  trackGa4EventOnce,
} from "@/lib/ga4";
import { readFirstTouchClient } from "@/lib/attribution-first-touch";
import { readPartnerRefClient } from "@/lib/partners/partner-ref-cookie";

function acquisitionParams(landingPage?: string) {
  return buildAcquisitionContext({
    firstTouch: readFirstTouchClient(),
    partnerReferralPresent: Boolean(readPartnerRefClient()),
    landingPageOverride: landingPage,
  });
}

/** Fires once per tab session when the marketing homepage is viewed. */
export function ContractorLandingViewTracker() {
  useEffect(() => {
    trackGa4EventOnce(
      "contractor_landing_view",
      GA4_FUNNEL_EVENTS.contractor_landing_view,
      acquisitionParams("/")
    );
  }, []);
  return null;
}

/** Fires once per tab session when the public sample quote is viewed. */
export function SampleQuoteViewTracker() {
  useEffect(() => {
    trackGa4EventOnce(
      "sample_quote_view",
      GA4_FUNNEL_EVENTS.sample_quote_view,
      acquisitionParams()
    );
  }, []);
  return null;
}

/** "See a Sample Quote" links. Not a trial CTA, so it never fires contractor_cta_click. */
export function SampleQuoteCtaLink({
  href,
  ctaText,
  ctaLocation,
  className,
  children,
}: {
  href: string;
  ctaText: string;
  ctaLocation: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        trackGa4Event(GA4_FUNNEL_EVENTS.sample_quote_cta_click, {
          ...acquisitionParams(),
          cta_text: ctaText,
          cta_location: ctaLocation,
          destination: href,
        });
      }}
    >
      {children}
    </Link>
  );
}

export function ContractorAcquisitionCtaLink({
  href = "/signup",
  ctaText,
  ctaLocation,
  className,
  children,
}: {
  href?: string;
  ctaText: string;
  ctaLocation: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        trackGa4Event(GA4_FUNNEL_EVENTS.contractor_cta_click, {
          ...acquisitionParams(),
          cta_text: ctaText,
          cta_location: ctaLocation,
          destination: href,
        });
      }}
    >
      {children}
    </Link>
  );
}
