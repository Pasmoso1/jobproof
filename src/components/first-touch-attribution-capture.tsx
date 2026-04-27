"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureFirstTouchIfMissing } from "@/lib/attribution-first-touch";

export function FirstTouchAttributionCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams?.toString() ?? "";
    const pathWithQuery = `${pathname ?? "/"}${qs ? `?${qs}` : ""}`;
    captureFirstTouchIfMissing(pathWithQuery);
  }, [pathname, searchParams]);

  return null;
}
