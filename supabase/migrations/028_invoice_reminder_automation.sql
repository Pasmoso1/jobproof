-- Safe automated invoice reminders: per-contractor settings + reminder send audit trail.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invoice_reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_reminders_automation_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_remind_not_viewed_after_days integer NOT NULL DEFAULT 3
    CHECK (invoice_remind_not_viewed_after_days >= 1 AND invoice_remind_not_viewed_after_days <= 365),
  ADD COLUMN IF NOT EXISTS invoice_remind_viewed_after_days integer NOT NULL DEFAULT 5
    CHECK (invoice_remind_viewed_after_days >= 1 AND invoice_remind_viewed_after_days <= 365),
  ADD COLUMN IF NOT EXISTS invoice_remind_overdue_after_days integer NOT NULL DEFAULT 2
    CHECK (invoice_remind_overdue_after_days >= 1 AND invoice_remind_overdue_after_days <= 365),
  ADD COLUMN IF NOT EXISTS invoice_repeat_overdue_every_days integer NOT NULL DEFAULT 7
    CHECK (invoice_repeat_overdue_every_days >= 1 AND invoice_repeat_overdue_every_days <= 365);

COMMENT ON COLUMN public.profiles.invoice_reminders_enabled IS 'When true, cron may send automated invoice reminders using Eastern timing rules.';
COMMENT ON COLUMN public.profiles.invoice_reminders_automation_paused IS 'When true, skip automation even if invoice_reminders_enabled is true.';

CREATE TABLE public.invoice_reminder_sends (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('manual', 'automation')),
  reminder_kind text NOT NULL CHECK (reminder_kind IN ('standard', 'overdue', 'partial_balance')),
  email_status text NOT NULL CHECK (email_status IN ('success', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_reminder_sends_invoice_created
  ON public.invoice_reminder_sends(invoice_id, created_at DESC);
CREATE INDEX idx_invoice_reminder_sends_profile_created
  ON public.invoice_reminder_sends(profile_id, created_at DESC);

ALTER TABLE public.invoice_reminder_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own invoice reminder sends"
  ON public.invoice_reminder_sends FOR SELECT
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own invoice reminder sends"
  ON public.invoice_reminder_sends FOR INSERT
  WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );
