"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { capturePartnerRefFromSearchParamsClient } from "@/lib/partners/partner-ref-cookie";

/** Captures ?ref= on navigation into the Partner referral first-touch cookie. */
export function PartnerRefCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    capturePartnerRefFromSearchParamsClient();
  }, [pathname, searchParams]);

  return null;
}
