import { type NextRequest } from "next/server";
import {
  updateSession,
  type ProfileOnboardingFields,
} from "@/lib/supabase/middleware";
import { isBusinessProfileCompleteForApp } from "@/lib/validation/business-profile";

const PROTECTED_PATHS = ["/dashboard", "/jobs", "/estimates", "/settings", "/onboarding"];
const AUTH_PATHS = ["/login", "/signup"];
const ONBOARDING_PATH = "/onboarding/business-profile";
const PATHS_REQUIRING_ONBOARDING = ["/dashboard", "/jobs", "/estimates", "/settings"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isOnboardingPath(pathname: string): boolean {
  return pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`);
}

function requiresOnboarding(pathname: string): boolean {
  return PATHS_REQUIRING_ONBOARDING.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isProfileIncomplete(
  profile: ProfileOnboardingFields,
  accountEmail: string
): boolean {
  if (!profile) return true;
  return !isBusinessProfileCompleteForApp({
    business_name: profile.business_name,
    account_email: accountEmail,
    phone: profile.phone,
    address_line_1: profile.address_line_1,
    city: profile.city,
    province: profile.province,
    postal_code: profile.postal_code,
  });
}

export async function middleware(request: NextRequest) {
  const { response, user, profile } = await updateSession(request);

  const { pathname } = request.nextUrl;

  if (isProtected(pathname) && !isOnboardingPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return Response.redirect(url);
  }

  if (isOnboardingPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return Response.redirect(url);
  }

  if (isAuthPath(pathname) && user) {
    const url = request.nextUrl.clone();
    url.pathname = isProfileIncomplete(profile, user.email ?? "")
      ? ONBOARDING_PATH
      : "/dashboard";
    return Response.redirect(url);
  }

  if (
    user &&
    requiresOnboarding(pathname) &&
    isProfileIncomplete(profile, user.email ?? "")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = ONBOARDING_PATH;
    url.searchParams.set("redirect", pathname);
    if (request.nextUrl.searchParams.get("confirmed") === "true") {
      url.searchParams.set("confirmed", "true");
    }
    return Response.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
