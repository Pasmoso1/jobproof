-- Public signing page: distinguish invalid / withdrawn / expired / used vs ok (for clear UX)
-- Unused tokens are deleted on withdraw in app; missing row => invalid

CREATE OR REPLACE FUNCTION public.resolve_change_order_signing_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT
    t.used_at AS t_used_at,
    t.expires_at AS t_expires_at,
    co.status AS co_status,
    co.id AS co_id,
    co.job_id,
    co.change_title,
    co.change_description,
    co.reason_for_change,
    co.original_contract_price,
    co.change_amount,
    co.revised_total_price,
    j.title AS job_title,
    cust.full_name AS customer_name
  INTO r
  FROM public.change_order_signing_tokens t
  JOIN public.change_orders co ON co.id = t.change_order_id
  JOIN public.jobs j ON j.id = co.job_id
  JOIN public.customers cust ON cust.id = j.customer_id
  WHERE t.token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;

  IF r.t_used_at IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'used');
  END IF;

  IF r.t_expires_at <= now() THEN
    RETURN jsonb_build_object('outcome', 'expired');
  END IF;

  IF r.co_status IS DISTINCT FROM 'sent' THEN
    RETURN jsonb_build_object('outcome', 'withdrawn');
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'ok',
    'change_order_id', r.co_id,
    'job_id', r.job_id,
    'change_title', r.change_title,
    'change_description', r.change_description,
    'reason_for_change', r.reason_for_change,
    'original_contract_price', r.original_contract_price,
    'change_amount', r.change_amount,
    'revised_total_price', r.revised_total_price,
    'job_title', r.job_title,
    'customer_name', r.customer_name,
    'expires_at', r.t_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_change_order_signing_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_change_order_signing_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_change_order_signing_token(text) TO service_role;
