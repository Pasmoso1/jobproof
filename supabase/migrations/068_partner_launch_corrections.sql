-- Partner Program pre-launch corrections:
-- - remove unsafe direct partner-row updates under end-user RLS
-- - block direct public partner_applications inserts (server action uses service role)
-- - preserve trusted batch payout RPC execution for service role only
-- - add durable attribution-failure audit rows
-- - backfill pending referral paid clocks from billing events using active-only streaks

DROP POLICY IF EXISTS partners_update_own_payment ON public.partners;
DROP POLICY IF EXISTS partners_update_own_auth_user ON public.partners;

DROP POLICY IF EXISTS partner_applications_insert_public ON public.partner_applications;

GRANT EXECUTE ON FUNCTION public.record_partner_batch_payout(
  uuid, text, text, text, timestamptz, text, text
) TO service_role;
REVOKE ALL ON FUNCTION public.record_partner_batch_payout(
  uuid, text, text, text, timestamptz, text, text
) FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.partner_attribution_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_user_id uuid,
  contractor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  referral_code text,
  source text NOT NULL,
  stage text NOT NULL,
  error_message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_notes text
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_attribution_failures_open_uidx
  ON public.partner_attribution_failures (contractor_user_id, referral_code)
  WHERE resolved_at IS NULL
    AND contractor_user_id IS NOT NULL
    AND referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS partner_attribution_failures_open_seen_idx
  ON public.partner_attribution_failures (resolved_at, last_seen_at DESC);

ALTER TABLE public.partner_attribution_failures ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.partner_attribution_failures IS
  'Durable audit rows for partner referral attribution failures that need ops follow-up.';

COMMENT ON COLUMN public.partner_attribution_failures.stage IS
  'Where attribution failed, e.g. missing_profile, insert_failed, service_role_missing.';

WITH pending_referrals AS (
  SELECT
    pr.id AS referral_id,
    pr.contractor_profile_id,
    lower(coalesce(p.subscription_status, '')) AS current_status
  FROM public.partner_referrals pr
  JOIN public.profiles p
    ON p.id = pr.contractor_profile_id
  WHERE pr.reward_status = 'pending'
),
last_break AS (
  SELECT
    pr.referral_id,
    max(b.created_at) AS last_break_at
  FROM pending_referrals pr
  LEFT JOIN public.billing_event_logs b
    ON b.profile_id = pr.contractor_profile_id
   AND lower(coalesce(b.new_subscription_status, '')) <> 'active'
  GROUP BY pr.referral_id
),
current_paid_window AS (
  SELECT
    pr.referral_id,
    CASE
      WHEN pr.current_status = 'active' THEN (
        SELECT min(b2.created_at)
        FROM public.billing_event_logs b2
        WHERE b2.profile_id = pr.contractor_profile_id
          AND lower(coalesce(b2.new_subscription_status, '')) = 'active'
          AND (
            lb.last_break_at IS NULL
            OR b2.created_at > lb.last_break_at
          )
      )
      ELSE NULL
    END AS paid_started_at
  FROM pending_referrals pr
  JOIN last_break lb
    ON lb.referral_id = pr.referral_id
)
UPDATE public.partner_referrals pr
SET
  subscription_started_at = cpw.paid_started_at,
  updated_at = now()
FROM current_paid_window cpw
WHERE pr.id = cpw.referral_id
  AND pr.reward_status = 'pending'
  AND pr.subscription_started_at IS DISTINCT FROM cpw.paid_started_at;
