import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decodeFirstTouchCookie, FIRST_TOUCH_COOKIE_NAME } from "@/lib/attribution-first-touch";

/** Allow open redirects only to same-origin relative paths. */
function isSafeRelativeRedirect(pathWithQuery: string): boolean {
  const path = pathWithQuery.split("?")[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("..")) return false;
  return true;
}

function loginErrorUrl(requestUrl: URL, kind: "auth" | "reset_link"): URL {
  const q = kind === "reset_link" ? "error=reset_link" : "error=auth";
  return new URL(`/login?${q}`, requestUrl);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");
  const code = searchParams.get("code");

  const wasResetFlow =
    type === "recovery" ||
    (next != null && next.split("?")[0] === "/update-password");

  // PKCE / server-side redirect: Supabase often sends `code` (no token_hash).
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const nextPath = next?.split("?")[0] ?? "";
      const redirectPath =
        nextPath === "/update-password"
          ? "/update-password"
          : next && isSafeRelativeRedirect(next)
            ? next
            : "/dashboard";
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    return NextResponse.redirect(loginErrorUrl(requestUrl, wasResetFlow ? "reset_link" : "auth"));
  }

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (error) {
      return NextResponse.redirect(loginErrorUrl(requestUrl, wasResetFlow ? "reset_link" : "auth"));
    }

    if (type === "recovery") {
      return NextResponse.redirect(new URL("/update-password", request.url));
    }

    const isSignupConfirmation = type === "signup" || type === "email";
    if (isSignupConfirmation) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const rawCookie = request.cookies.get(FIRST_TOUCH_COOKIE_NAME)?.value;
      const attribution = decodeFirstTouchCookie(rawCookie);

      if (user && attribution) {
        const { data: profile } = await supabase
          .from("profiles")
          .select(
            `
              signup_utm_source,
              signup_utm_medium,
              signup_utm_campaign,
              signup_utm_content,
              signup_utm_term,
              signup_referrer,
              signup_landing_page,
              signup_first_seen_at,
              heard_about_source
            `
          )
          .eq("user_id", user.id)
          .maybeSingle();

        const patch: Record<string, string | null> = {};
        if (!profile?.signup_utm_source && attribution.utm_source) {
          patch.signup_utm_source = attribution.utm_source;
        }
        if (!profile?.signup_utm_medium && attribution.utm_medium) {
          patch.signup_utm_medium = attribution.utm_medium;
        }
        if (!profile?.signup_utm_campaign && attribution.utm_campaign) {
          patch.signup_utm_campaign = attribution.utm_campaign;
        }
        if (!profile?.signup_utm_content && attribution.utm_content) {
          patch.signup_utm_content = attribution.utm_content;
        }
        if (!profile?.signup_utm_term && attribution.utm_term) {
          patch.signup_utm_term = attribution.utm_term;
        }
        if (!profile?.signup_referrer && attribution.referrer) {
          patch.signup_referrer = attribution.referrer;
        }
        if (!profile?.signup_landing_page && attribution.landing_page) {
          patch.signup_landing_page = attribution.landing_page;
        }
        if (!profile?.signup_first_seen_at && attribution.first_seen_at) {
          patch.signup_first_seen_at = attribution.first_seen_at;
        }
        if (!profile?.heard_about_source && attribution.heard_about_source) {
          patch.heard_about_source = attribution.heard_about_source;
        }

        if (Object.keys(patch).length > 0) {
          await supabase.from("profiles").update(patch).eq("user_id", user.id);
        }
      }
      return NextResponse.redirect(new URL("/dashboard?confirmed=true", request.url));
    }

    const redirectUrl =
      next && isSafeRelativeRedirect(next) ? next : "/dashboard";
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  return NextResponse.redirect(loginErrorUrl(requestUrl, wasResetFlow ? "reset_link" : "auth"));
}
