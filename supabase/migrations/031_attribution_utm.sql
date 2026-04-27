-- UTM / acquisition attribution for waitlist and real account signups

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'waitlist_signups'
  ) THEN
    ALTER TABLE public.waitlist_signups
      ADD COLUMN IF NOT EXISTS utm_source text,
      ADD COLUMN IF NOT EXISTS utm_medium text,
      ADD COLUMN IF NOT EXISTS utm_campaign text,
      ADD COLUMN IF NOT EXISTS utm_content text,
      ADD COLUMN IF NOT EXISTS utm_term text,
      ADD COLUMN IF NOT EXISTS referrer text,
      ADD COLUMN IF NOT EXISTS landing_page text,
      ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
      ADD COLUMN IF NOT EXISTS heard_about_source text;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_utm_source text,
  ADD COLUMN IF NOT EXISTS signup_utm_medium text,
  ADD COLUMN IF NOT EXISTS signup_utm_campaign text,
  ADD COLUMN IF NOT EXISTS signup_utm_content text,
  ADD COLUMN IF NOT EXISTS signup_utm_term text,
  ADD COLUMN IF NOT EXISTS signup_referrer text,
  ADD COLUMN IF NOT EXISTS signup_landing_page text,
  ADD COLUMN IF NOT EXISTS signup_first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS heard_about_source text;

COMMENT ON COLUMN public.profiles.signup_utm_source IS 'First-touch UTM source captured before account signup.';
COMMENT ON COLUMN public.profiles.signup_utm_medium IS 'First-touch UTM medium captured before account signup.';
COMMENT ON COLUMN public.profiles.signup_utm_campaign IS 'First-touch UTM campaign captured before account signup.';
COMMENT ON COLUMN public.profiles.signup_utm_content IS 'First-touch UTM content captured before account signup.';
COMMENT ON COLUMN public.profiles.signup_utm_term IS 'First-touch UTM term captured before account signup.';
COMMENT ON COLUMN public.profiles.signup_referrer IS 'Browser referrer from first tracked touch.';
COMMENT ON COLUMN public.profiles.signup_landing_page IS 'First tracked landing path + query.';
COMMENT ON COLUMN public.profiles.signup_first_seen_at IS 'Timestamp for first tracked acquisition touch.';
COMMENT ON COLUMN public.profiles.heard_about_source IS 'Optional self-reported channel selected by user.';
