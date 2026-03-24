import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getRecentEmailLogs } from "@/app/(app)/actions";
import { BusinessSettingsForm } from "./business-settings-form";
import { RecentEmailActivity } from "./recent-email-activity";

export default async function BusinessSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile, emailLogs] = await Promise.all([getProfile(), getRecentEmailLogs(30)]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Business settings</h1>
        <p className="mt-1 text-zinc-600">
          This information will appear on your contracts and invoices and is required.
        </p>
      </div>

      <BusinessSettingsForm
        profile={profile}
        userEmail={user.email ?? ""}
      />

      <RecentEmailActivity logs={emailLogs} />
    </div>
  );
}
