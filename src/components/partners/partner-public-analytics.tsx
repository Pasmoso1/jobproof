"use client";

import { useEffect, useRef } from "react";
import { trackPartnerPublicEvent } from "@/app/partners/actions";

export function PartnerAgreementViewTracker() {
  useEffect(() => {
    void trackPartnerPublicEvent("partner_agreement_viewed");
  }, []);
  return null;
}

export function FoundingPartnerSectionTracker({
  children,
}: {
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const sent = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!sent.current && entries.some((entry) => entry.isIntersecting)) {
          sent.current = true;
          void trackPartnerPublicEvent("founding_partner_section_viewed");
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
