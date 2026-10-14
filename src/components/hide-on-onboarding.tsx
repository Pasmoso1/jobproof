"use client";

import { usePathname } from "next/navigation";

/** Onboarding steps already explain trial setup; avoid repeating it above them. */
export function HideOnOnboarding({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/onboarding" || pathname?.startsWith("/onboarding/")) return null;
  return <>{children}</>;
}
