"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ADMIN_BACK_TO_APP_HREF,
  ADMIN_NAV_GROUPS,
  resolveActiveNavItem,
} from "@/lib/admin/navigation";

/**
 * The one navigation list used by both the desktop sidebar and the mobile drawer.
 * Active state comes from the current route (nested routes supported).
 */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  const active = resolveActiveNavItem(pathname);

  return (
    <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-4">
      <div className="space-y-6">
        {ADMIN_NAV_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`admin-nav-${group.id}`}>
            <h2
              id={`admin-nav-${group.id}`}
              className="px-3 text-xs font-semibold uppercase tracking-wide text-zinc-500"
            >
              {group.label}
            </h2>
            <ul className="mt-2 space-y-1">
              {group.items.map((item) => {
                const isActive = active?.href === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 ${
                        isActive
                          ? "bg-[#2436BB]/10 font-semibold text-[#2436BB]"
                          : "font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}

/** Link back to the main contractor-facing JobProof app. */
export function AdminBackToAppLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="border-t border-zinc-200 p-3">
      <Link
        href={ADMIN_BACK_TO_APP_HREF}
        onClick={onNavigate}
        className="flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
      >
        <span aria-hidden="true" className="mr-2">
          ←
        </span>
        Back to JobProof app
      </Link>
    </div>
  );
}
