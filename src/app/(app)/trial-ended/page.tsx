import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JobProofLogo } from "@/components/jobproof-logo";
import { needsTrialExpiredIntro } from "@/lib/trial-lifecycle";
import { TrialEndedActions } from "./trial-ended-actions";

export const dynamic = "force-dynamic";

export default async function TrialEndedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/trial-ended");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      `
      id,
      beta_tester,
      subscription_status,
      stripe_subscription_id,
      trial_started_at,
      trial_ends_at,
      trial_expired_screen_seen_at
    `
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login");

  if (!needsTrialExpiredIntro(profile)) {
    redirect("/dashboard");
  }

  // Align status with expiry so later checks use subscription_status = expired.
  if (String(profile.subscription_status ?? "").toLowerCase() !== "expired") {
    await supabase
      .from("profiles")
      .update({ subscription_status: "expired" })
      .eq("id", profile.id)
      .is("stripe_subscription_id", null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-lg text-center">
        <JobProofLogo className="mx-auto mb-8 h-10 w-auto" />
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          Your free trial has ended
        </h1>
        <p className="mt-3 text-lg text-zinc-600">Thanks for trying JobProof.</p>
        <div className="mt-6 space-y-4 text-left text-base leading-relaxed text-zinc-700">
          <p>
            Your customers, quote requests, site visit notes, proposals, photos, and project
            history are still here.
          </p>
          <p>Nothing has been deleted.</p>
          <p>Your account is now in read-only mode until you subscribe.</p>
          <p>
            Once you subscribe, you&apos;ll immediately regain full access and can continue exactly
            where you left off.
          </p>
        </div>
        <TrialEndedActions />
        <p className="mt-6 text-sm text-zinc-500">
          You can subscribe at any time to continue creating quotes, customers, contracts, and new
          projects.
        </p>
      </div>
    </div>
  );
}
