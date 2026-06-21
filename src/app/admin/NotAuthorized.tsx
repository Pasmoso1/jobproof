import Link from "next/link";
import { JobProofLogo } from "@/components/jobproof-logo";
import { parseAdminEmails } from "@/lib/admin-auth";
import { AdminSignOutButton } from "@/app/admin/admin-sign-out-button";

export function AdminNotAuthorized({ userEmail }: { userEmail: string }) {
  const hasConfiguredAllowlist = parseAdminEmails().length > 0;
  const displayEmail = userEmail?.trim() || "(no email)";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <Link href="/" className="mb-6 block text-center">
          <JobProofLogo className="mx-auto h-9 w-auto" />
        </Link>

        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Admin access required</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
          You&apos;re signed in as{" "}
          <span className="font-medium text-zinc-900">{displayEmail}</span>, but this account does not
          have access to the admin dashboard.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <AdminSignOutButton />
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Back to contractor dashboard
          </Link>
        </div>

        {!hasConfiguredAllowlist && (
          <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Admin access is not configured on this deployment (ADMIN_EMAILS is empty).
          </p>
        )}
      </div>
    </div>
  );
}
