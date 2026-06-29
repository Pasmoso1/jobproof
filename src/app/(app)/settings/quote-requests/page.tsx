import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAppUrl } from "@/lib/stripe";
import { QuoteRequestSettingsForm } from "./quote-request-settings-form";

export const dynamic = "force-dynamic";

export default async function QuoteRequestSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings/quote-requests");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "quote_slug, business_name, phone, quote_logo_url, quote_pricing_profile, quote_primary_trade, quote_primary_trade_other, contractor_extra_capabilities"
    )
    .eq("user_id", user.id)
    .single();

  const appOrigin = resolveAppUrl();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Quote requests</h1>
        <p className="mt-1 text-zinc-600">
          Configure your public quote page so homeowners can submit project requests before a job
          exists.
        </p>
      </div>

      <QuoteRequestSettingsForm profile={profile} appOrigin={appOrigin} />

      {profile?.quote_slug ? (
        <p className="mt-4 text-sm text-zinc-600">
          View incoming requests on the{" "}
          <Link href="/quote-requests" className="font-medium text-[#2436BB] hover:underline">
            Quote Requests
          </Link>{" "}
          page.
        </p>
      ) : null}
    </div>
  );
}
