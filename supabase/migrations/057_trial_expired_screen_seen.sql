-- One-time intro shown the first time a contractor returns after trial expiry.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_expired_screen_seen_at timestamptz;

COMMENT ON COLUMN public.profiles.trial_expired_screen_seen_at IS
  'When the contractor dismissed the post-trial expiry introduction screen. Null until shown once.';
