import Link from "next/link";
import { AdminBackToAppLink, AdminNav } from "@/components/admin/admin-nav";
import { ADMIN_HOME_HREF } from "@/lib/admin/navigation";

/** Persistent desktop sidebar (hidden below `lg`; the mobile drawer takes over). */
export function AdminSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-200 bg-white lg:flex">
      <div className="flex h-14 items-center border-b border-zinc-200 px-5">
        <Link
          href={ADMIN_HOME_HREF}
          className="text-sm font-semibold text-[#2436BB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
        >
          JobProof Admin
        </Link>
      </div>
      <AdminNav />
      <AdminBackToAppLink />
    </aside>
  );
}
