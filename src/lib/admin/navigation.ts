/**
 * Single source of truth for the Admin Command Centre navigation.
 *
 * Only pages that exist today appear in {@link ADMIN_NAV_GROUPS}. Planned sections live in
 * {@link ADMIN_PLANNED_NAV} and are intentionally NOT rendered (no fake or empty pages).
 * To ship a planned section: create its `page.tsx`, move the entry into a group, and the
 * route-integrity test will verify the destination exists.
 */

export type AdminNavItem = {
  label: string;
  href: string;
  /** Default `prefix`: also active on nested routes (`/admin/partners/payouts/…`). */
  match?: "exact" | "prefix";
  /** Extra route prefixes that should highlight this item (e.g. detail pages it links to). */
  alsoActiveFor?: readonly string[];
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: readonly AdminNavItem[];
};

export const ADMIN_HOME_HREF = "/admin";
/** Link back to the main JobProof application. */
export const ADMIN_BACK_TO_APP_HREF = "/dashboard";

export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    items: [
      { label: "Overview", href: "/admin", match: "exact" },
      {
        label: "Product usage",
        href: "/admin/usage",
        // Contractor detail pages are reached from the usage table today.
        alsoActiveFor: ["/admin/users"],
      },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    items: [{ label: "Stripe readiness", href: "/admin/stripe-readiness" }],
  },
  {
    id: "partners",
    label: "Partners",
    items: [
      { label: "Partner Management", href: "/admin/partners" },
      { label: "Partner Payouts", href: "/admin/partners/payouts" },
    ],
  },
  {
    id: "reporting",
    label: "Reporting",
    items: [
      { label: "Product analytics", href: "/admin/analytics" },
      { label: "Early access signups", href: "/admin/waitlist" },
    ],
  },
];

/** Roadmap entries that are deliberately hidden until their pages exist. */
export const ADMIN_PLANNED_NAV: ReadonlyArray<{ group: string; label: string }> = [
  { group: "Contractors", label: "Contractors" },
  { group: "Billing", label: "Subscriptions" },
  { group: "Customer Experience", label: "Support" },
  { group: "System", label: "Platform Health" },
  { group: "Reporting", label: "Reports" },
  { group: "Administration", label: "Settings" },
];

export function allAdminNavItems(
  groups: readonly AdminNavGroup[] = ADMIN_NAV_GROUPS
): AdminNavItem[] {
  return groups.flatMap((g) => [...g.items]);
}

function normalizePathname(pathname: string): string {
  const path = String(pathname ?? "").split("?")[0]?.split("#")[0] ?? "";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * The single nav item that should be highlighted for `pathname`: the matching item with
 * the longest route, so `/admin/partners/payouts/x` selects "Partner Payouts" rather than
 * "Partner Management", and `/admin` (exact) never swallows other admin pages.
 */
export function resolveActiveNavItem(
  pathname: string,
  groups: readonly AdminNavGroup[] = ADMIN_NAV_GROUPS
): AdminNavItem | null {
  const path = normalizePathname(pathname);
  let best: { item: AdminNavItem; score: number } | null = null;
  for (const item of allAdminNavItems(groups)) {
    const candidates: number[] = [];
    if (item.match === "exact") {
      if (path === item.href) candidates.push(item.href.length);
    } else if (matchesPrefix(path, item.href)) {
      candidates.push(item.href.length);
    }
    for (const extra of item.alsoActiveFor ?? []) {
      if (matchesPrefix(path, extra)) candidates.push(extra.length);
    }
    if (candidates.length === 0) continue;
    const score = Math.max(...candidates);
    if (!best || score > best.score) best = { item, score };
  }
  return best?.item ?? null;
}
