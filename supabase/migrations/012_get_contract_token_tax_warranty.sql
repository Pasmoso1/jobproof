-- Expose tax rate and warranty/cancellation notes on remote signing preview

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
    AND t.used_at IS NULL
    AND t.expires_at > now()
    AND c.status = 'pending';
END;
$$;
