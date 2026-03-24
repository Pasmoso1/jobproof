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
} | null;

export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: User | null;
  profile: ProfileOnboardingFields;
}> {
  let response = NextResponse.next({
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
        "business_name, phone, address_line_1, city, province, postal_code"
      )
      .eq("user_id", user.id)
      .single();
    profile = data;
  }

  return { response, user, profile };
}
