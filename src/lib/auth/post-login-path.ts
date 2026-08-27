import type { ProfileOnboardingFields } from "@/lib/supabase/middleware";
import { BETA_PLAN_ONBOARDING_PATH, needsPlanSelection } from "@/lib/beta-tester";
import {
  isOnboardingCompleteForTrial,
  needsTrialExpiredIntro,
} from "@/lib/trial-lifecycle";

const BUSINESS_ONBOARDING_PATH = "/onboarding/business-profile";
const TRIAL_ENDED_PATH = "/trial-ended";

/**
 * Default post-login destination for normal JobProof contractor/customer sign-in
 * (no explicit Partner Program `next`).
 */
export function resolveContractorPostLoginPath(
  profile: ProfileOnboardingFields,
  accountEmail: string
): string {
  if (needsPlanSelection(profile)) {
    return BETA_PLAN_ONBOARDING_PATH;
  }
  if (!profile || !isOnboardingCompleteForTrial(profile, accountEmail)) {
    return BUSINESS_ONBOARDING_PATH;
  }
  if (needsTrialExpiredIntro(profile)) {
    return TRIAL_ENDED_PATH;
  }
  return "/dashboard";
}
