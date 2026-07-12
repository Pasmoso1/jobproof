-- Track ops email delivery for feature requests (mirrors support_tickets).

ALTER TABLE public.feature_requests
  ADD COLUMN IF NOT EXISTS email_notification_sent_at timestamptz;

COMMENT ON COLUMN public.feature_requests.email_notification_sent_at IS
  'Set when an ops notification email is successfully sent (future retries can target null rows).';
