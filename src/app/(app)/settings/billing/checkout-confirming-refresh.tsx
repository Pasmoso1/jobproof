"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const MAX_AUTO_REFRESHES = 3;
const REFRESH_INTERVAL_MS = 4000;

/**
 * While a Checkout return is still being confirmed, re-run the server sync a few
 * times, then stop and point the customer at Refresh / support instead of spinning forever.
 */
export function CheckoutConfirmingRefresh() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (attempts >= MAX_AUTO_REFRESHES) return;
    const timer = window.setTimeout(() => {
      setAttempts((n) => n + 1);
      router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [attempts, router]);

  if (attempts < MAX_AUTO_REFRESHES) {
    return <p className="mt-1">This usually takes a few seconds.</p>;
  }
  return (
    <p className="mt-1">
      This is taking longer than expected. Select Refresh billing status below, or contact support
      if your subscription still isn&apos;t showing.
    </p>
  );
}
