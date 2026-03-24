-- Add job_address, customer_email, customer_phone to get_contract_by_signing_token for full contract preview

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
    t.expires_at
  FROM public.contract_signing_tokens t
  JOIN public.contracts c ON c.id = t.contract_id
  WHERE t.token = p_token
    AND t.used_at IS NULL
    AND t.expires_at > now()
    AND c.status = 'pending';
END;
$$;
