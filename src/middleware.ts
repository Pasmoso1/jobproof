import { type NextRequest } from "next/server";
import {
  updateSession,
  type ProfileOnboardingFields,
} from "@/lib/supabase/middleware";
import { BETA_PLAN_ONBOARDING_PATH, needsPlanSelection } from "@/lib/beta-tester";
import {
  isOnboardingCompleteForTrial,
  needsTrialActivation,
  needsTrialExpiredIntro,
} from "@/lib/trial-lifecycle";
import {
  isAdminPath,
  resolveAuthenticatedAuthPathRedirect,
} from "@/lib/auth/safe-redirect";
import {
  ADMIN_RESPONSE_HEADERS,
  resolveAdminMiddlewareRedirect,
} from "@/lib/admin/middleware-guard";
import { resolveContractorPostLoginPath } from "@/lib/auth/post-login-path";

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
  "/partner",
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

/** Business name + primary trade missing, or a chosen plan whose trial was never activated. */
function needsBusinessSetup(profile: ProfileOnboardingFields): boolean {
  if (!profile) return true;
  return !isOnboardingCompleteForTrial(profile) || needsTrialActivation(profile);
}

export async function middleware(request: NextRequest) {
  const { response, user, profile } = await updateSession(request);

  const { pathname } = request.nextUrl;

  // Admin area: anonymous visitors go to login with the deep link preserved. Who counts
  // as an admin (ADMIN_EMAILS) is enforced server-side on every page/action/route.
  const adminLoginRedirect = resolveAdminMiddlewareRedirect({
    pathname,
    search: request.nextUrl.search,
    hasSession: Boolean(user),
  });
  if (adminLoginRedirect) {
    return Response.redirect(new URL(adminLoginRedirect, request.nextUrl.origin));
  }
  if (isAdminPath(pathname)) {
    for (const [name, value] of Object.entries(ADMIN_RESPONSE_HEADERS)) {
      response.headers.set(name, value);
    }
  }

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
    const next =
      request.nextUrl.searchParams.get("next") ??
      request.nextUrl.searchParams.get("redirect");
    const destination = resolveAuthenticatedAuthPathRedirect({
      next,
      contractorFallbackPath: resolveContractorPostLoginPath(profile),
    });
    return Response.redirect(new URL(destination, request.nextUrl.origin));
  }

  if (user && requiresOnboarding(pathname)) {
    // Plan first, then business profile + primary trade.
    if (needsPlanSelection(profile)) {
      const url = request.nextUrl.clone();
      url.pathname = BETA_PLAN_ONBOARDING_PATH;
      // Preserve confirmation flash for UI (analytics uses a separate cookie marker).
      if (request.nextUrl.searchParams.get("confirmed") === "true") {
        url.searchParams.set("confirmed", "true");
      }
      return Response.redirect(url);
    }
    if (needsBusinessSetup(profile)) {
      const url = request.nextUrl.clone();
      url.pathname = BUSINESS_ONBOARDING_PATH;
      url.searchParams.set("redirect", pathname);
      if (request.nextUrl.searchParams.get("confirmed") === "true") {
        url.searchParams.set("confirmed", "true");
      }
      return Response.redirect(url);
    }
  }

  // Plan page stays available to change plan until the trial starts; afterwards it is locked.
  if (
    user &&
    (pathname === BETA_PLAN_ONBOARDING_PATH || pathname.startsWith(`${BETA_PLAN_ONBOARDING_PATH}/`)) &&
    !needsPlanSelection(profile) &&
    !needsTrialActivation(profile)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = needsBusinessSetup(profile)
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
