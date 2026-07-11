-- JobProof-managed 14-day free trial (no Stripe until subscribe).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_plan_tier text
    CHECK (trial_plan_tier IS NULL OR trial_plan_tier IN ('essential', 'professional')),
  ADD COLUMN IF NOT EXISTS trial_email_welcome_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_email_started_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_email_day3_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_email_day7_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_email_day12_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_email_ended_sent_at timestamptz;

COMMENT ON COLUMN public.profiles.trial_started_at IS
  'When the JobProof-managed 14-day trial began (after onboarding). Null until setup is complete.';
COMMENT ON COLUMN public.profiles.trial_plan_tier IS
  'Plan selected for the free trial (essential=Solo, professional=Pro). Locked during trial.';
COMMENT ON COLUMN public.profiles.trial_ends_at IS
  'End of JobProof-managed free trial or Stripe trial end when applicable.';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check1;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check2;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check3;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check4;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check5;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check6;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check7;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check8;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check9;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (
    subscription_status IN (
      'pending_trial',
      'trial',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'cancelled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
      'expired'
    )
  );

-- New signups wait for plan selection + onboarding before the trial clock starts.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    plan_type,
    subscription_status,
    active_job_limit,
    storage_limit_mb
  )
  VALUES (
    NEW.id,
    'solo',
    'pending_trial',
    10,
    10240
  );

  INSERT INTO public.storage_usage (profile_id, total_bytes)
  SELECT id, 0 FROM public.profiles WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$;

-- Existing accounts that never started Stripe and have no trial end remain pending.
UPDATE public.profiles
SET subscription_status = 'pending_trial'
WHERE subscription_status = 'trial'
  AND trial_started_at IS NULL
  AND trial_ends_at IS NULL
  AND COALESCE(stripe_subscription_id, '') = ''
  AND COALESCE(beta_tester, false) = false;
