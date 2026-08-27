import { AdminHeader } from "@/app/admin/admin-header";

/**
 * Shared admin shell so Sign out (and chrome) appear on every `/admin/*` page.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminHeader />
      {children}
    </>
  );
}
