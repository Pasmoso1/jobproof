-- Beta tester accounts: full access without Stripe subscription during testing.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS beta_tester boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beta_plan_tier text CHECK (beta_plan_tier IN ('essential', 'professional'));

CREATE INDEX IF NOT EXISTS idx_profiles_beta_tester ON public.profiles (beta_tester)
  WHERE beta_tester = true;

COMMENT ON COLUMN public.profiles.beta_tester IS 'When true, billing enforcement is bypassed (beta testing cohort).';
COMMENT ON COLUMN public.profiles.beta_plan_tier IS 'Plan tier selected during beta onboarding (essential or professional).';
