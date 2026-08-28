-- Grouped partner payouts: needs_review status, verification audit, atomic batch payout RPC.

-- Extend reward_status with needs_review (internal admin workflow).
ALTER TABLE partner_referrals
  DROP CONSTRAINT IF EXISTS partner_referrals_reward_status_check;

ALTER TABLE partner_referrals
  ADD CONSTRAINT partner_referrals_reward_status_check
  CHECK (reward_status IN (
    'pending',
    'qualified',
    'needs_review',
    'approved',
    'paid',
    'cancelled',
    'forfeited'
  ));

ALTER TABLE partner_referrals
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS invalidated_at timestamptz,
  ADD COLUMN IF NOT EXISTS invalidated_reason text,
  ADD COLUMN IF NOT EXISTS invalidated_by text;

-- Paid referrals must reference a payout record.
ALTER TABLE partner_referrals
  DROP CONSTRAINT IF EXISTS partner_referrals_paid_requires_payout;

ALTER TABLE partner_referrals
  ADD CONSTRAINT partner_referrals_paid_requires_payout
  CHECK (reward_status <> 'paid' OR payout_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS partner_referrals_ready_payout_idx
  ON partner_referrals (partner_id)
  WHERE reward_status = 'approved' AND payout_id IS NULL;

CREATE INDEX IF NOT EXISTS partner_referrals_needs_review_idx
  ON partner_referrals (partner_id, qualification_date DESC)
  WHERE reward_status = 'needs_review';

-- Snapshot payout metadata for history and grouped payments.
ALTER TABLE partner_payouts
  ADD COLUMN IF NOT EXISTS payment_email text,
  ADD COLUMN IF NOT EXISTS referral_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS partner_payouts_idempotency_key_uidx
  ON partner_payouts (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Backfill referral_count for legacy single-referral payouts.
UPDATE partner_payouts p
SET referral_count = sub.cnt
FROM (
  SELECT payout_id, COUNT(*) AS cnt
  FROM partner_referrals
  WHERE payout_id IS NOT NULL
  GROUP BY payout_id
) sub
WHERE p.id = sub.payout_id
  AND p.referral_count = 1
  AND sub.cnt > 1;

COMMENT ON COLUMN partner_referrals.verification_notes IS
  'Automated or admin verification notes (semicolon-separated reasons).';
COMMENT ON COLUMN partner_payouts.payment_email IS
  'Partner payment email snapshot at payout time (Interac e-Transfer).';
COMMENT ON COLUMN partner_payouts.idempotency_key IS
  'Optional key to prevent duplicate payout creation on retries.';

-- Atomically record one grouped payout for all approved, unpaid referrals on a partner.
CREATE OR REPLACE FUNCTION public.record_partner_batch_payout(
  p_partner_id uuid,
  p_payment_method text,
  p_payment_reference text,
  p_notes text,
  p_paid_at timestamptz,
  p_created_by text,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_email text;
  v_payout_id uuid;
  v_referral_ids uuid[];
  v_total numeric(10, 2);
  v_count int;
  v_updated int;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_payout_id
    FROM partner_payouts
    WHERE idempotency_key = p_idempotency_key;

    IF v_payout_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'payout_id', v_payout_id,
        'idempotent', true
      );
    END IF;
  END IF;

  SELECT trim(payment_email)
  INTO v_payment_email
  FROM partners
  WHERE id = p_partner_id;

  IF v_payment_email IS NULL OR v_payment_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing payment email');
  END IF;

  -- Lock all eligible referrals for this partner.
  PERFORM id
  FROM partner_referrals
  WHERE partner_id = p_partner_id
    AND reward_status = 'approved'
    AND payout_id IS NULL
  FOR UPDATE;

  SELECT
    array_agg(id ORDER BY qualification_date NULLS LAST, signup_date, id),
    COALESCE(SUM(reward_amount), 0),
    COUNT(*)::int
  INTO v_referral_ids, v_total, v_count
  FROM partner_referrals
  WHERE partner_id = p_partner_id
    AND reward_status = 'approved'
    AND payout_id IS NULL;

  IF v_count IS NULL OR v_count = 0 OR v_total <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No rewards ready for payment');
  END IF;

  INSERT INTO partner_payouts (
    partner_id,
    amount,
    payment_method,
    payment_reference,
    notes,
    paid_at,
    payment_email,
    referral_count,
    created_by,
    idempotency_key
  )
  VALUES (
    p_partner_id,
    v_total,
    NULLIF(trim(p_payment_method), ''),
    NULLIF(trim(p_payment_reference), ''),
    NULLIF(trim(p_notes), ''),
    COALESCE(p_paid_at, now()),
    v_payment_email,
    v_count,
    NULLIF(trim(p_created_by), ''),
    NULLIF(trim(p_idempotency_key), '')
  )
  RETURNING id INTO v_payout_id;

  UPDATE partner_referrals
  SET
    reward_status = 'paid',
    reward_paid_at = COALESCE(p_paid_at, now()),
    payout_id = v_payout_id,
    updated_at = now()
  WHERE id = ANY (v_referral_ids)
    AND reward_status = 'approved'
    AND payout_id IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> v_count THEN
    RAISE EXCEPTION 'Payout referral update mismatch: expected %, got %', v_count, v_updated;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'payout_id', v_payout_id,
    'amount', v_total,
    'referral_count', v_count,
    'payment_email', v_payment_email
  );
EXCEPTION
  WHEN unique_violation THEN
    IF p_idempotency_key IS NOT NULL THEN
      SELECT id INTO v_payout_id
      FROM partner_payouts
      WHERE idempotency_key = p_idempotency_key;

      IF v_payout_id IS NOT NULL THEN
        RETURN jsonb_build_object(
          'ok', true,
          'payout_id', v_payout_id,
          'idempotent', true
        );
      END IF;
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.record_partner_batch_payout(
  uuid, text, text, text, timestamptz, text, text
) FROM PUBLIC;
