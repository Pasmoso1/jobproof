-- Signing token lifecycle: status (active | used | cancelled), cancel on contract withdraw (pending→draft)

-- -----------------------------------------------------------------------------
-- 1. Token status column
-- -----------------------------------------------------------------------------
ALTER TABLE public.contract_signing_tokens
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.contract_signing_tokens
SET status = 'used'
WHERE used_at IS NOT NULL AND (status IS NULL OR status = '');

UPDATE public.contract_signing_tokens
SET status = 'active'
WHERE used_at IS NULL AND (status IS NULL OR status = '');

ALTER TABLE public.contract_signing_tokens
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE public.contract_signing_tokens
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.contract_signing_tokens
  DROP CONSTRAINT IF EXISTS contract_signing_tokens_status_check;

ALTER TABLE public.contract_signing_tokens
  ADD CONSTRAINT contract_signing_tokens_status_check
  CHECK (status IN ('active', 'used', 'cancelled'));

-- -----------------------------------------------------------------------------
-- 2. When contract returns to draft from pending, cancel unconsumed tokens
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_signing_tokens_on_contract_withdraw()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'draft' THEN
    UPDATE public.contract_signing_tokens
    SET status = 'cancelled'
    WHERE contract_id = NEW.id
      AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contracts_cancel_tokens_on_withdraw ON public.contracts;
CREATE TRIGGER contracts_cancel_tokens_on_withdraw
  AFTER UPDATE OF status ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_signing_tokens_on_contract_withdraw();

-- -----------------------------------------------------------------------------
-- 3. Lookup + signing RPCs: require active token
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_contract_by_signing_token(text);

CREATE OR REPLACE FUNCTION public.get_contract_by_signing_token(p_token text)
RETURNS TABLE (
  contract_id uuid,
  job_id uuid,
  contract_data jsonb,
  customer_name text,
  customer_email text,
  customer_phone text,
  job_title text,
  job_address text,
  scope_of_work text,
  price numeric,
  deposit_amount numeric,
  payment_terms text,
  company_name text,
  contractor_name text,
  contractor_email text,
  contractor_phone text,
  contractor_address text,
  tax_rate numeric,
  warranty_note text,
  cancellation_change_note text,
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
    c.customer_email,
    c.customer_phone,
    c.job_title,
    c.job_address,
    c.scope_of_work,
    c.price,
    c.deposit_amount,
    c.payment_terms,
    c.company_name,
    c.contractor_name,
    c.contractor_email,
    c.contractor_phone,
    c.contractor_address,
    c.tax_rate,
    c.warranty_note,
    c.cancellation_change_note,
    t.expires_at
  FROM public.contract_signing_tokens t
  JOIN public.contracts c ON c.id = t.contract_id
  WHERE t.token = p_token
    AND t.status = 'active'
    AND t.used_at IS NULL
    AND t.expires_at > now()
    AND c.status = 'pending';
END;
$$;

DROP FUNCTION IF EXISTS public.sign_contract_remote(text, text, text, text, boolean, text, text);

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
    AND t.status = 'active'
    AND t.used_at IS NULL
    AND t.expires_at > now()
    AND c.status = 'pending';

  IF v_token_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired signing link');
  END IF;

  SELECT job_id INTO v_job_id FROM public.contracts WHERE id = v_contract_id;

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
  SET used_at = now(),
      status = 'used'
  WHERE id = v_token_id;

  UPDATE public.jobs
  SET contract_status = 'signed'
  WHERE id = v_job_id;

  RETURN jsonb_build_object('success', true, 'contract_id', v_contract_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Bundle for public signing page: contract payload or structured failure reason
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_remote_signing_bundle(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  tr public.contract_signing_tokens%ROWTYPE;
  c_status text;
BEGIN
  SELECT * INTO tr
  FROM public.contract_signing_tokens t
  WHERE t.token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  IF tr.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cancelled');
  END IF;

  IF tr.used_at IS NOT NULL OR tr.status = 'used' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_used');
  END IF;

  IF tr.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  SELECT c.status INTO c_status
  FROM public.contracts c
  WHERE c.id = tr.contract_id;

  IF c_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  IF c_status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'withdrawn');
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'ok', true,
      'contract_id', c.id,
      'job_id', c.job_id,
      'contract_data', c.contract_data,
      'customer_name', c.customer_name,
      'customer_email', c.customer_email,
      'customer_phone', c.customer_phone,
      'job_title', c.job_title,
      'job_address', c.job_address,
      'scope_of_work', c.scope_of_work,
      'price', c.price,
      'deposit_amount', c.deposit_amount,
      'payment_terms', c.payment_terms,
      'company_name', c.company_name,
      'contractor_name', c.contractor_name,
      'contractor_email', c.contractor_email,
      'contractor_phone', c.contractor_phone,
      'contractor_address', c.contractor_address,
      'tax_rate', c.tax_rate,
      'warranty_note', c.warranty_note,
      'cancellation_change_note', c.cancellation_change_note,
      'expires_at', tr.expires_at
    )
    FROM public.contracts c
    WHERE c.id = tr.contract_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_remote_signing_bundle(text) TO anon, authenticated, service_role;
