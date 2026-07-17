-- JobProof Partner Portal (invitation-based referral program)

-- Applications (pending until admin approval)
CREATE TABLE IF NOT EXISTS partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  website text,
  partner_type text NOT NULL,
  estimated_audience text,
  promotion_plan text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'approved', 'declined')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  decline_reason text,
  created_partner_id uuid,
  email_notification_sent_at timestamptz,
  applicant_confirmation_sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS partner_applications_status_idx
  ON partner_applications (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS partner_applications_email_idx
  ON partner_applications (lower(email));

-- Approved (or suspended) partners
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES partner_applications (id) ON DELETE SET NULL,
  profile_id uuid REFERENCES profiles (id) ON DELETE SET NULL,
  organization_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  website text,
  partner_type text NOT NULL,
  partner_level text NOT NULL DEFAULT 'standard'
    CHECK (partner_level IN ('founding', 'standard')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'declined')),
  referral_code text NOT NULL UNIQUE,
  payment_email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS partners_email_lower_uidx
  ON partners (lower(email));
CREATE INDEX IF NOT EXISTS partners_profile_id_idx ON partners (profile_id)
  WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS partners_status_idx ON partners (status);

ALTER TABLE partner_applications
  DROP CONSTRAINT IF EXISTS partner_applications_created_partner_id_fkey;
ALTER TABLE partner_applications
  ADD CONSTRAINT partner_applications_created_partner_id_fkey
  FOREIGN KEY (created_partner_id) REFERENCES partners (id) ON DELETE SET NULL;

-- Permanent referral attributions
CREATE TABLE IF NOT EXISTS partner_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  contractor_profile_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  contractor_business_name text,
  signup_date timestamptz NOT NULL DEFAULT now(),
  trial_started_at timestamptz,
  subscription_started_at timestamptz,
  qualification_date timestamptz,
  reward_amount numeric(10, 2) NOT NULL,
  reward_status text NOT NULL DEFAULT 'pending'
    CHECK (reward_status IN (
      'pending',
      'qualified',
      'approved',
      'paid',
      'cancelled',
      'forfeited'
    )),
  reward_paid_at timestamptz,
  payout_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contractor_profile_id)
);

CREATE INDEX IF NOT EXISTS partner_referrals_partner_idx
  ON partner_referrals (partner_id, reward_status);
CREATE INDEX IF NOT EXISTS partner_referrals_qualify_idx
  ON partner_referrals (reward_status, subscription_started_at)
  WHERE reward_status = 'pending' AND subscription_started_at IS NOT NULL;

-- Manual payouts
CREATE TABLE IF NOT EXISTS partner_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL,
  payment_method text,
  payment_reference text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_payouts_partner_idx
  ON partner_payouts (partner_id, paid_at DESC);

ALTER TABLE partner_referrals
  DROP CONSTRAINT IF EXISTS partner_referrals_payout_id_fkey;
ALTER TABLE partner_referrals
  ADD CONSTRAINT partner_referrals_payout_id_fkey
  FOREIGN KEY (payout_id) REFERENCES partner_payouts (id) ON DELETE SET NULL;

-- First-touch partner referral on contractor profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS signup_partner_referral_code text;

CREATE INDEX IF NOT EXISTS profiles_signup_partner_referral_code_idx
  ON profiles (signup_partner_referral_code)
  WHERE signup_partner_referral_code IS NOT NULL;

-- RLS: partners read own data; public insert applications; admins via service role
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_payouts ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an application (anon + authenticated)
DROP POLICY IF EXISTS partner_applications_insert_public ON partner_applications;
CREATE POLICY partner_applications_insert_public
  ON partner_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Partners can read their own application by email match (optional soft access)
DROP POLICY IF EXISTS partner_applications_select_own ON partner_applications;
CREATE POLICY partner_applications_select_own
  ON partner_applications FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS partners_select_own ON partners;
CREATE POLICY partners_select_own
  ON partners FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS partners_update_own_payment ON partners;
CREATE POLICY partners_update_own_payment
  ON partners FOR UPDATE
  TO authenticated
  USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS partner_referrals_select_own ON partner_referrals;
CREATE POLICY partner_referrals_select_own
  ON partner_referrals FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners
      WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS partner_payouts_select_own ON partner_payouts;
CREATE POLICY partner_payouts_select_own
  ON partner_payouts FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners
      WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

COMMENT ON TABLE partners IS 'Invitation-based JobProof partner program accounts.';
COMMENT ON TABLE partner_referrals IS 'Permanent contractor→partner referral attributions and reward status.';
COMMENT ON COLUMN partners.partner_level IS 'founding ($150) for first 10 approvals; standard ($100) thereafter. Admin may override.';
