import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LogoutButton } from "./logout-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <img
              src="/jobproof-logo.png"
              alt="Job Proof"
              className="h-8 w-auto"
            />
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Dashboard
            </Link>
            <Link
              href="/collections"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Collections
            </Link>
            <Link
              href="/jobs/create"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Create Job
            </Link>
            <Link
              href="/settings/business"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Settings
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
