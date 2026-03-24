-- JobProof Phase 2: Contracts, signing, delivery scaffolding

-- =============================================================================
-- 1. CONTRACTS table
-- =============================================================================

CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'signed', 'void')),
  contract_data jsonb NOT NULL DEFAULT '{}',
  pdf_path text,
  signed_at timestamptz,
  signed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_by_name text,
  signing_method text CHECK (signing_method IN ('device', 'remote')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_job_id ON public.contracts(job_id);
CREATE INDEX idx_contracts_profile_id ON public.contracts(profile_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);

-- =============================================================================
-- 2. CONTRACT_SIGNING_TOKENS: for remote signing links
-- =============================================================================

CREATE TABLE public.contract_signing_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_signing_tokens_token ON public.contract_signing_tokens(token);
CREATE INDEX idx_contract_signing_tokens_contract_id ON public.contract_signing_tokens(contract_id);

-- =============================================================================
-- 3. Triggers
-- =============================================================================

DROP TRIGGER IF EXISTS contracts_updated_at ON public.contracts;
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 4. RLS
-- =============================================================================

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signing_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contracts"
  ON public.contracts FOR ALL
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Tokens: anyone with valid token can SELECT contract for signing (handled in app)
-- For security: no direct RLS on tokens; we validate in server action
CREATE POLICY "Service role can manage signing tokens"
  ON public.contract_signing_tokens FOR ALL
  USING (true)
  WITH CHECK (true);

-- Restrict token access: only allow SELECT by token value for signing flow
-- We'll use a server action that validates token and returns contract data
-- So we need: anon can't read tokens. Only our server (service role or RPC) can.
-- Simpler: use a policy that allows SELECT only when contract belongs to user
-- For remote signing: customer doesn't have auth. We need anon read by token.
-- Create a more permissive policy for tokens - we validate in app logic.
DROP POLICY IF EXISTS "Service role can manage signing tokens" ON public.contract_signing_tokens;
CREATE POLICY "Allow token lookup for signing"
  ON public.contract_signing_tokens FOR SELECT
  USING (true);

CREATE POLICY "Users can manage signing tokens for own contracts"
  ON public.contract_signing_tokens FOR ALL
  USING (
    contract_id IN (
      SELECT c.id FROM public.contracts c
      JOIN public.profiles p ON c.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    contract_id IN (
      SELECT c.id FROM public.contracts c
      JOIN public.profiles p ON c.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Drop the permissive SELECT - we'll use a Postgres function with SECURITY DEFINER
-- to fetch contract by token for the public signing page.
DROP POLICY IF EXISTS "Allow token lookup for signing" ON public.contract_signing_tokens;

-- Function: get contract by signing token (for remote signing page)
CREATE OR REPLACE FUNCTION public.get_contract_by_signing_token(p_token text)
RETURNS TABLE (
  contract_id uuid,
  job_id uuid,
  contract_data jsonb,
  customer_name text,
  job_title text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.job_id,
    c.contract_data,
    cust.full_name,
    j.title,
    t.expires_at
  FROM public.contract_signing_tokens t
  JOIN public.contracts c ON c.id = t.contract_id
  JOIN public.jobs j ON j.id = c.job_id
  JOIN public.customers cust ON cust.id = j.customer_id
  WHERE t.token = p_token
    AND t.used_at IS NULL
    AND t.expires_at > now()
    AND c.status = 'pending';
END;
$$;

-- Function: sign contract remotely (for unauthenticated customer)
CREATE OR REPLACE FUNCTION public.sign_contract_remote(
  p_token text,
  p_signed_by_name text,
  p_signed_by_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token_id uuid;
  v_contract_id uuid;
  v_job_id uuid;
BEGIN
  SELECT t.id, t.contract_id INTO v_token_id, v_contract_id
  FROM public.contract_signing_tokens t
  JOIN public.contracts c ON c.id = t.contract_id
  WHERE t.token = p_token
    AND t.used_at IS NULL
    AND t.expires_at > now()
    AND c.status = 'pending';

  IF v_token_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired signing link');
  END IF;

  SELECT job_id INTO v_job_id FROM public.contracts WHERE id = v_contract_id;

  UPDATE public.contracts
  SET status = 'signed',
      signed_at = now(),
      signed_by_name = p_signed_by_name || ' (' || p_signed_by_email || ')',
      signing_method = 'remote'
  WHERE id = v_contract_id;

  UPDATE public.contract_signing_tokens
  SET used_at = now()
  WHERE id = v_token_id;

  UPDATE public.jobs
  SET contract_status = 'signed'
  WHERE id = v_job_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- =============================================================================
-- 5. Storage bucket for contract PDFs
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-pdfs',
  'contract-pdfs',
  false,
  5242880,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload contract PDFs to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contract-pdfs'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

CREATE POLICY "Users can read own contract PDFs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contract-pdfs'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);
