import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

export type ProfileOnboardingFields = {
  business_name: string | null;
  phone: string | null;
  address_line_1: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  quote_primary_trade?: string | null;
  beta_tester?: boolean | null;
  beta_plan_tier?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  plan_tier?: string | null;
  trial_plan_tier?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
} | null;

export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: User | null;
  profile: ProfileOnboardingFields;
}> {
  const response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: ProfileOnboardingFields = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select(
        "business_name, phone, address_line_1, city, province, postal_code, quote_primary_trade, beta_tester, beta_plan_tier, stripe_subscription_id, subscription_status, plan_tier, trial_plan_tier, trial_started_at, trial_ends_at"
      )
      .eq("user_id", user.id)
      .single();
    profile = data;
  }

  return { response, user, profile };
}
