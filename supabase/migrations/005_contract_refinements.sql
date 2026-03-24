-- JobProof Phase 2.5: Contract refinements for MVP
-- Structured columns, signature audit, locking, PDF flow

-- =============================================================================
-- 1. Rename version -> version_number
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'version'
  ) THEN
    ALTER TABLE public.contracts RENAME COLUMN version TO version_number;
  END IF;
END $$;

-- =============================================================================
-- 2. Add structured contract columns
-- =============================================================================

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS contractor_name text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS job_address text,
  ADD COLUMN IF NOT EXISTS scope_of_work text,
  ADD COLUMN IF NOT EXISTS price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS tax_included boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warranty_note text,
  ADD COLUMN IF NOT EXISTS cancellation_change_note text;

-- =============================================================================
-- 3. Add signature audit columns (replace/expand signed_by_name)
-- =============================================================================

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS signer_name text,
  ADD COLUMN IF NOT EXISTS signer_email text,
  ADD COLUMN IF NOT EXISTS signer_phone text,
  ADD COLUMN IF NOT EXISTS signature_image_path text,
  ADD COLUMN IF NOT EXISTS signed_ip_address text,
  ADD COLUMN IF NOT EXISTS signed_user_agent text,
  ADD COLUMN IF NOT EXISTS consent_checkbox_boolean boolean DEFAULT false;

-- Migrate signed_by_name -> signer_name for existing rows
UPDATE public.contracts
SET signer_name = signed_by_name
WHERE signed_by_name IS NOT NULL AND signer_name IS NULL;

-- =============================================================================
-- 4. Add trigger to prevent updates to signed contracts
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prevent_signed_contract_edit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'signed' THEN
    IF OLD.pdf_path IS NULL AND NEW.pdf_path IS NOT NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify a signed contract. Use change orders for amendments.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contracts_prevent_signed_edit ON public.contracts;
CREATE TRIGGER contracts_prevent_signed_edit
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  WHEN (OLD.status = 'signed')
  EXECUTE FUNCTION public.prevent_signed_contract_edit();

-- =============================================================================
-- 5. Update get_contract_by_signing_token to return structured fields
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_contract_by_signing_token(text);

CREATE OR REPLACE FUNCTION public.get_contract_by_signing_token(p_token text)
RETURNS TABLE (
  contract_id uuid,
  job_id uuid,
  contract_data jsonb,
  customer_name text,
  job_title text,
  scope_of_work text,
  price numeric,
  deposit_amount numeric,
  payment_terms text,
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
    c.customer_name,
    c.job_title,
    c.scope_of_work,
    c.price,
    c.deposit_amount,
    c.payment_terms,
    t.expires_at
  FROM public.contract_signing_tokens t
  JOIN public.contracts c ON c.id = t.contract_id
  WHERE t.token = p_token
    AND t.used_at IS NULL
    AND t.expires_at > now()
    AND c.status = 'pending';
END;
$$;

-- =============================================================================
-- 6. Update sign_contract_remote with full signature audit
-- =============================================================================

DROP FUNCTION IF EXISTS public.sign_contract_remote(text, text, text);

CREATE OR REPLACE FUNCTION public.sign_contract_remote(
  p_token text,
  p_signer_name text,
  p_signer_email text,
  p_signer_phone text DEFAULT NULL,
  p_consent_checkbox boolean DEFAULT false,
  p_signed_ip_address text DEFAULT NULL,
  p_signed_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token_id uuid;
  v_contract_id uuid;
  v_job_id uuid;
  v_pdf_path text;
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

  -- Placeholder: signed PDF generation (returns null until implemented)
  v_pdf_path := NULL;

  UPDATE public.contracts
  SET status = 'signed',
      signed_at = now(),
      signer_name = p_signer_name,
      signer_email = p_signer_email,
      signer_phone = p_signer_phone,
      signing_method = 'remote',
      signed_ip_address = p_signed_ip_address,
      signed_user_agent = p_signed_user_agent,
      consent_checkbox_boolean = p_consent_checkbox,
      pdf_path = COALESCE(pdf_path, v_pdf_path)
  WHERE id = v_contract_id;

  UPDATE public.contract_signing_tokens
  SET used_at = now()
  WHERE id = v_token_id;

  UPDATE public.jobs
  SET contract_status = 'signed'
  WHERE id = v_job_id;

  RETURN jsonb_build_object('success', true, 'contract_id', v_contract_id);
END;
$$;

-- =============================================================================
-- 7. sign_contract_device: customer signs on contractor's device
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sign_contract_device(
  p_contract_id uuid,
  p_signer_name text,
  p_signer_email text,
  p_signer_phone text DEFAULT NULL,
  p_consent_checkbox boolean DEFAULT false,
  p_signed_ip_address text DEFAULT NULL,
  p_signed_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_profile_id uuid;
  v_pdf_path text;
BEGIN
  SELECT job_id, profile_id INTO v_job_id, v_profile_id
  FROM public.contracts
  WHERE id = p_contract_id
    AND status = 'pending';

  IF v_job_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found or already signed');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_profile_id
    AND p.user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  v_pdf_path := NULL;

  UPDATE public.contracts
  SET status = 'signed',
      signed_at = now(),
      signer_name = p_signer_name,
      signer_email = p_signer_email,
      signer_phone = p_signer_phone,
      signing_method = 'device',
      signed_ip_address = p_signed_ip_address,
      signed_user_agent = p_signed_user_agent,
      consent_checkbox_boolean = p_consent_checkbox,
      pdf_path = COALESCE(pdf_path, v_pdf_path)
  WHERE id = p_contract_id;

  UPDATE public.jobs
  SET contract_status = 'signed'
  WHERE id = v_job_id;

  RETURN jsonb_build_object('success', true, 'contract_id', p_contract_id);
END;
$$;
