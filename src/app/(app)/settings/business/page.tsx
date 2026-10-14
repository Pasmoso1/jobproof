import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getRecentEmailLogs } from "@/app/(app)/actions";
import { resolveSafeLoginRedirect } from "@/lib/auth/safe-redirect";
import {
  getMissingBusinessDetails,
  MISSING_BUSINESS_DETAIL_LABELS,
} from "@/lib/validation/business-profile";
import { BusinessSettingsForm } from "./business-settings-form";
import { RecentEmailActivity } from "./recent-email-activity";

export default async function BusinessSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile, emailLogs, params] = await Promise.all([
    getProfile(),
    getRecentEmailLogs(30),
    searchParams,
  ]);

  const requestedReturn = resolveSafeLoginRedirect(params.returnTo ?? null, "");
  const returnTo =
    requestedReturn && !requestedReturn.startsWith("/settings/business") ? requestedReturn : null;
  const missing = getMissingBusinessDetails(profile);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={returnTo ?? "/dashboard"}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          {returnTo ? "← Back" : "← Back to dashboard"}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Business settings</h1>
        <p className="mt-1 text-zinc-600">
          Your business details appear on the contracts, quotes and invoices your customers receive.
        </p>
      </div>

      {missing.length > 0 ? (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">
            Still needed: {missing.map((m) => MISSING_BUSINESS_DETAIL_LABELS[m]).join(", ")}
          </p>
          <p className="mt-1">
            {returnTo
              ? "Add these to continue. We'll take you back when you save."
              : "Add these before sending contracts, quotes or invoices."}
          </p>
        </div>
      ) : null}

      <BusinessSettingsForm profile={profile} userEmail={user.email ?? ""} returnTo={returnTo} />

      <RecentEmailActivity logs={emailLogs} />
    </div>
  );
}
