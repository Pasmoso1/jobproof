-- Contractor Success Center: support tickets + feature requests

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  category text NOT NULL
    CHECK (category IN (
      'general_question',
      'need_help',
      'bug_report',
      'feature_suggestion',
      'billing'
    )),
  message text NOT NULL,
  -- Hidden client/environment metadata for future email + triage
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  -- Reserved for future email notifications
  email_notification_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_profile_id_idx
  ON public.support_tickets (profile_id);
CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx
  ON public.support_tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx
  ON public.support_tickets (status);

COMMENT ON TABLE public.support_tickets IS
  'In-app Contractor Success Center contact form submissions.';
COMMENT ON COLUMN public.support_tickets.metadata IS
  'Client context: current_page, browser, os, screen_size, app_version, user_agent, etc.';
COMMENT ON COLUMN public.support_tickets.email_notification_sent_at IS
  'Set when an ops notification email is sent (future).';

CREATE TABLE IF NOT EXISTS public.feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL
    CHECK (category IN (
      'quoting',
      'customers',
      'billing',
      'mobile',
      'integrations',
      'reporting',
      'other'
    )),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'planned', 'shipped', 'declined')),
  -- Reserved for future voting
  vote_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_requests_profile_id_idx
  ON public.feature_requests (profile_id);
CREATE INDEX IF NOT EXISTS feature_requests_created_at_idx
  ON public.feature_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS feature_requests_status_idx
  ON public.feature_requests (status);

COMMENT ON TABLE public.feature_requests IS
  'Contractor feature ideas from the Success Center. vote_count reserved for future voting.';

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own support tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own support tickets"
  ON public.support_tickets FOR SELECT
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own feature requests"
  ON public.feature_requests FOR INSERT
  WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own feature requests"
  ON public.feature_requests FOR SELECT
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );
