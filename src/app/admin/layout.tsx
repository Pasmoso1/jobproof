import { AdminHeader } from "@/app/admin/admin-header";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requireAdminUser } from "@/lib/admin-auth";

/**
 * Shared admin shell: persistent sidebar on desktop, drawer on mobile, Sign out everywhere.
 *
 * The navigation is only rendered for an allowlisted admin. Signed-in non-admins (and any
 * request that slipped past middleware) get just the minimal header + the page's own
 * access-denied view. Pages, server actions and route handlers still authorize
 * independently; this layout check only decides what chrome to show.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireAdminUser();

  if (!auth.ok) {
    return (
      <>
        <AdminHeader />
        {children}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 lg:flex">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <AdminHeader leading={<AdminMobileNav />} userEmail={auth.userEmail} />
        {children}
      </div>
    </div>
  );
}
