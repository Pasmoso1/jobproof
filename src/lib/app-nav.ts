export type AppNavLinkKey =
  | "dashboard"
  | "collections"
  | "estimates"
  | "quote-requests"
  | "create-job"
  | "settings"
  | "billing"
  | "support"
  | "partner-portal";

export type AppNavLink = {
  key: AppNavLinkKey;
  label: string;
  href: string;
};

/** Single source of truth for authenticated app navigation (desktop row and mobile menu). */
export function getAppNavLinks(options: { showPartnerPortal: boolean }): AppNavLink[] {
  const links: AppNavLink[] = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    { key: "collections", label: "Collections", href: "/collections" },
    { key: "estimates", label: "Estimates", href: "/estimates" },
    { key: "quote-requests", label: "Quote Requests", href: "/quote-requests" },
    { key: "create-job", label: "Create Job", href: "/jobs/create" },
    { key: "settings", label: "Settings", href: "/settings/business" },
    { key: "billing", label: "Billing", href: "/settings/billing" },
    { key: "support", label: "Support", href: "/support" },
  ];
  if (options.showPartnerPortal) {
    links.push({ key: "partner-portal", label: "Partner Portal", href: "/partner" });
  }
  return links;
}

export function isAppNavLinkActive(pathname: string, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
