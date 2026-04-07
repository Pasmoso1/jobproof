-- Include job property province so public signing page can show tax consistent with invoices.
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
      'property_province', j.property_province,
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
    INNER JOIN public.jobs j ON j.id = c.job_id
    WHERE c.id = tr.contract_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_remote_signing_bundle(text) TO anon, authenticated, service_role;
