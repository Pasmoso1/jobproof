"use client";

import { useEffect } from "react";
import { capturePartnerRefFromSearchParamsClient } from "@/lib/partners/partner-ref-cookie";

/** Captures ?ref= on any page load into the partner referral cookie. */
export function PartnerRefCapture() {
  useEffect(() => {
    capturePartnerRefFromSearchParamsClient();
  }, []);
  return null;
}
