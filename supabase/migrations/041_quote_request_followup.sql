-- Optional AI follow-up questions after public quote request submission

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS follow_up_token uuid UNIQUE;

COMMENT ON COLUMN public.quote_requests.follow_up_token IS
  'Secret token for customer follow-up Q&A after public submit (no auth required).';

CREATE TABLE public.quote_request_followup_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text,
  question_type text NOT NULL,
  display_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_request_followup_answers_request_order_unique UNIQUE (quote_request_id, display_order),
  CONSTRAINT quote_request_followup_answers_question_type_check CHECK (
    question_type IN (
      'multiple_choice',
      'checkbox',
      'short_text',
      'number',
      'date',
      'yes_no'
    )
  )
);

CREATE INDEX idx_quote_request_followup_answers_request_id
  ON public.quote_request_followup_answers(quote_request_id);

COMMENT ON TABLE public.quote_request_followup_answers IS
  'Customer answers to optional post-submit follow-up questions';

ALTER TABLE public.quote_request_followup_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors read own quote request follow-up answers"
  ON public.quote_request_followup_answers FOR SELECT
  USING (
    quote_request_id IN (
      SELECT qr.id FROM public.quote_requests qr
      WHERE qr.contractor_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );
