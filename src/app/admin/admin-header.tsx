import type { ReactNode } from "react";
import Link from "next/link";
import { AdminSignOutButton } from "@/app/admin/admin-sign-out-button";

/**
 * Shared admin chrome — Sign out is always visible (desktop + mobile).
 * `leading` hosts the mobile navigation trigger; `userEmail` is shown on wide screens.
 */
export function AdminHeader({
  leading,
  userEmail,
}: {
  leading?: ReactNode;
  userEmail?: string | null;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <Link
            href="/admin"
            className="truncate text-sm font-semibold text-zinc-900 hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2 lg:hidden"
          >
            JobProof Admin
          </Link>
          {userEmail ? (
            <span className="hidden truncate text-sm text-zinc-500 lg:inline">
              Signed in as <span className="font-medium text-zinc-700">{userEmail}</span>
            </span>
          ) : null}
        </div>
        <AdminSignOutButton />
      </div>
    </header>
  );
}
