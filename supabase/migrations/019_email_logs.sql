-- Delivery audit trail for transactional emails (contract / change order / invoice)

CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('contract', 'change_order', 'invoice')),
  recipient_email text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  error_message text,
  related_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_logs_profile_created ON public.email_logs(profile_id, created_at DESC);
CREATE INDEX idx_email_logs_related_entity ON public.email_logs(related_entity_id)
  WHERE related_entity_id IS NOT NULL;

COMMENT ON TABLE public.email_logs IS 'Append-only log of email send attempts for debugging delivery.';
COMMENT ON COLUMN public.email_logs.type IS 'contract | change_order | invoice';
COMMENT ON COLUMN public.email_logs.related_entity_id IS 'Optional FK target: contracts.id, change_orders.id, invoices.id, etc.';

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own email logs"
  ON public.email_logs FOR SELECT
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own email logs"
  ON public.email_logs FOR INSERT
  WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );
