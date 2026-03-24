import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/app/(app)/actions";
import { isBusinessProfileCompleteForApp } from "@/lib/validation/business-profile";
import { OnboardingBusinessForm } from "./onboarding-business-form";

export default async function OnboardingBusinessProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string; redirect?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  const params = await searchParams;

  if (
    profile &&
    isBusinessProfileCompleteForApp({
      business_name: profile.business_name,
      account_email: user.email ?? "",
      phone: profile.phone,
      address_line_1: profile.address_line_1,
      city: profile.city,
      province: profile.province,
      postal_code: profile.postal_code,
    })
  ) {
    redirect(params.redirect ?? "/dashboard");
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8 text-center">
        <img
          src="/jobproof-logo.png"
          alt="Job Proof"
          className="mx-auto mb-6 h-10 w-auto"
        />
        <h1 className="text-2xl font-bold text-zinc-900">Set up your business profile</h1>
        <p className="mt-2 text-sm text-zinc-600">
          This information will appear on your contracts and invoices and is required.
        </p>
      </div>

      <OnboardingBusinessForm
        profile={profile}
        userEmail={user.email ?? ""}
        confirmed={params.confirmed === "true"}
      />
    </div>
  );
}
