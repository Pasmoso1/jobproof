-- Track library question source for adaptive interview branching

ALTER TABLE public.quote_request_followup_answers
  ADD COLUMN IF NOT EXISTS library_question_id text;

COMMENT ON COLUMN public.quote_request_followup_answers.library_question_id IS
  'JobProof question library id when the follow-up question came from the library';
