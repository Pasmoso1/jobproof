"use client";

import { useEffect, useRef } from "react";
import { confirmGa4PurchaseAfterCheckout } from "@/app/(app)/settings/billing/actions";
import { trackPurchaseOnce } from "@/lib/ga4-billing";

/**
 * After Stripe Checkout return (?checkout=success&session_id=…), ask the server
 * to verify the session + first-paid transition, then fire GA4 purchase once.
 */
export function Ga4PurchaseAfterCheckoutTracker({
  checkoutSuccess,
  checkoutSessionId,
}: {
  checkoutSuccess: boolean;
  checkoutSessionId: string;
}) {
  const attempted = useRef(false);

  useEffect(() => {
    if (!checkoutSuccess) return;
    const sessionId = checkoutSessionId.trim();
    if (!sessionId) return;
    if (attempted.current) return;
    attempted.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const result = await confirmGa4PurchaseAfterCheckout({
          checkoutSessionId: sessionId,
        });
        if (cancelled || !result.eligible) return;
        trackPurchaseOnce({
          transactionId: result.transactionId,
          planTier: result.planTier,
          pricingVersion: result.pricingVersion,
          currency: result.currency,
          valueCad: result.valueCad,
        });
      } catch {
        // Leave once-key unset so a later successful verification can still track.
        attempted.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkoutSuccess, checkoutSessionId]);

  return null;
}
