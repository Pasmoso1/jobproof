import { parseAdminEmails } from "@/lib/admin-auth";

export function AdminNotAuthorized({ userEmail }: { userEmail: string }) {
  const configured = parseAdminEmails();
  const hasConfiguredAllowlist = configured.length > 0;
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">Not authorized</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Your signed-in account does not have access to the admin dashboard.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Signed in as: <span className="font-medium text-zinc-700">{userEmail || "(no email)"}</span>
        </p>
        {!hasConfiguredAllowlist && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            ADMIN_EMAILS is missing or empty on this deployment.
          </p>
        )}
      </div>
    </div>
  );
}
