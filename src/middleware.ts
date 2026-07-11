import { type NextRequest } from "next/server";
import {
  updateSession,
  type ProfileOnboardingFields,
} from "@/lib/supabase/middleware";
import { isBusinessProfileCompleteForApp } from "@/lib/validation/business-profile";
import { BETA_PLAN_ONBOARDING_PATH, needsPlanSelection } from "@/lib/beta-tester";
import { isOnboardingCompleteForTrial, needsTrialExpiredIntro } from "@/lib/trial-lifecycle";

const PROTECTED_PATHS = [
  "/dashboard",
  "/jobs",
  "/estimates",
  "/quote-requests",
  "/settings",
  "/onboarding",
  "/collections",
  "/customers",
  "/trial-ended",
  "/support",
];
const AUTH_PATHS = ["/login", "/signup"];
const BUSINESS_ONBOARDING_PATH = "/onboarding/business-profile";
const TRIAL_ENDED_PATH = "/trial-ended";
const PATHS_REQUIRING_ONBOARDING = [
  "/dashboard",
  "/jobs",
  "/estimates",
  "/quote-requests",
  "/settings",
  "/collections",
  "/customers",
  "/support",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isOnboardingPath(pathname: string): boolean {
  return (
    pathname === BUSINESS_ONBOARDING_PATH ||
    pathname.startsWith(`${BUSINESS_ONBOARDING_PATH}/`) ||
    pathname === BETA_PLAN_ONBOARDING_PATH ||
    pathname.startsWith(`${BETA_PLAN_ONBOARDING_PATH}/`)
  );
}

function isTrialEndedPath(pathname: string): boolean {
  return pathname === TRIAL_ENDED_PATH || pathname.startsWith(`${TRIAL_ENDED_PATH}/`);
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
  return !isOnboardingCompleteForTrial(profile, accountEmail);
}

function isBusinessIncomplete(
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

function postLoginPath(profile: ProfileOnboardingFields, accountEmail: string): string {
  if (needsPlanSelection(profile)) {
    return BETA_PLAN_ONBOARDING_PATH;
  }
  if (isProfileIncomplete(profile, accountEmail)) {
    return BUSINESS_ONBOARDING_PATH;
  }
  if (needsTrialExpiredIntro(profile)) {
    return TRIAL_ENDED_PATH;
  }
  return "/dashboard";
}

export async function middleware(request: NextRequest) {
  const { response, user, profile } = await updateSession(request);

  const { pathname } = request.nextUrl;

  if (isProtected(pathname) && !isOnboardingPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return Response.redirect(url);
  }

  if (isOnboardingPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return Response.redirect(url);
  }

  if (isAuthPath(pathname) && user) {
    const url = request.nextUrl.clone();
    url.pathname = postLoginPath(profile, user.email ?? "");
    return Response.redirect(url);
  }

  if (user && requiresOnboarding(pathname)) {
    // Plan first, then business profile + primary trade.
    if (needsPlanSelection(profile)) {
      const url = request.nextUrl.clone();
      url.pathname = BETA_PLAN_ONBOARDING_PATH;
      return Response.redirect(url);
    }
    if (isProfileIncomplete(profile, user.email ?? "")) {
      const url = request.nextUrl.clone();
      url.pathname = BUSINESS_ONBOARDING_PATH;
      url.searchParams.set("redirect", pathname);
      if (request.nextUrl.searchParams.get("confirmed") === "true") {
        url.searchParams.set("confirmed", "true");
      }
      return Response.redirect(url);
    }
  }

  // Plan page: if plan already selected, send to business onboarding or dashboard.
  if (
    user &&
    (pathname === BETA_PLAN_ONBOARDING_PATH || pathname.startsWith(`${BETA_PLAN_ONBOARDING_PATH}/`)) &&
    !needsPlanSelection(profile)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = isBusinessIncomplete(profile, user.email ?? "")
      ? BUSINESS_ONBOARDING_PATH
      : isProfileIncomplete(profile, user.email ?? "")
        ? BUSINESS_ONBOARDING_PATH
        : needsTrialExpiredIntro(profile)
          ? TRIAL_ENDED_PATH
          : "/dashboard";
    return Response.redirect(url);
  }

  // First visit after trial expiry: dedicated intro once, then never again.
  if (
    user &&
    !isTrialEndedPath(pathname) &&
    !isOnboardingPath(pathname) &&
    requiresOnboarding(pathname) &&
    needsTrialExpiredIntro(profile)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = TRIAL_ENDED_PATH;
    return Response.redirect(url);
  }

  // Already dismissed (or not applicable): don't stay on the intro page.
  if (user && isTrialEndedPath(pathname) && !needsTrialExpiredIntro(profile)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return Response.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
