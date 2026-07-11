-- Backfill profile limit columns from effective plan_tier / beta_plan_tier.
-- Application enforcement uses plan entitlements (computed from plan_tier), not these columns.
-- Keeping columns in sync helps admin/legacy displays.

UPDATE public.profiles
SET
  active_job_limit = CASE
    WHEN COALESCE(beta_tester, false) = true AND beta_plan_tier = 'professional' THEN 1000000
    WHEN plan_tier = 'professional' THEN 1000000
    ELSE 10
  END,
  storage_limit_mb = CASE
    WHEN COALESCE(beta_tester, false) = true AND beta_plan_tier = 'professional' THEN 102400
    WHEN plan_tier = 'professional' THEN 102400
    ELSE 10240
  END
WHERE true;
