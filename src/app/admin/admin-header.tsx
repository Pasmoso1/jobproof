import Link from "next/link";
import { AdminSignOutButton } from "@/app/admin/admin-sign-out-button";

/**
 * Shared admin chrome — Sign out is always visible (desktop + mobile).
 */
export function AdminHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/admin"
          className="truncate text-sm font-semibold text-zinc-900 hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
        >
          JobProof Admin
        </Link>
        <AdminSignOutButton />
      </div>
    </header>
  );
}
