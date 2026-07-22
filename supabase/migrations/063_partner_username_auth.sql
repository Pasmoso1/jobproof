-- Partner username + Auth account linking for Partner Program applications.
-- Passwords remain exclusively in Supabase Auth (never auth.users). Never store
-- passwords or hashes in partner_applications / partners.

-- Global case-insensitive username registry (final authority for uniqueness).
CREATE TABLE IF NOT EXISTS partner_username_registry (
  normalized_username text PRIMARY KEY,
  username text NOT NULL,
  auth_user_id uuid NOT NULL,
  application_id uuid REFERENCES partner_applications (id) ON DELETE SET NULL,
  partner_id uuid REFERENCES partners (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_username_registry_normalized_format
    CHECK (normalized_username = lower(normalized_username))
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_username_registry_auth_user_uidx
  ON partner_username_registry (auth_user_id);

ALTER TABLE partner_applications
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS normalized_username text,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS normalized_username text,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS partner_applications_normalized_username_uidx
  ON partner_applications (normalized_username)
  WHERE normalized_username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS partner_applications_auth_user_uidx
  ON partner_applications (auth_user_id)
  WHERE auth_user_id IS NOT NULL
    AND status IN ('submitted', 'under_review', 'approved');

CREATE UNIQUE INDEX IF NOT EXISTS partners_normalized_username_uidx
  ON partners (normalized_username)
  WHERE normalized_username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS partners_auth_user_uidx
  ON partners (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS partner_applications_auth_user_id_idx
  ON partner_applications (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS partners_auth_user_id_idx
  ON partners (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON TABLE partner_username_registry IS
  'Case-insensitive partner username claims. Passwords are never stored here.';
COMMENT ON COLUMN partner_applications.auth_user_id IS
  'Supabase Auth user created or linked during application. Nullable for legacy rows.';
COMMENT ON COLUMN partner_applications.username IS
  'Display username chosen at apply time. Nullable for legacy rows.';
COMMENT ON COLUMN partners.auth_user_id IS
  'Copied from approved application. Preferred authorization key over email matching.';
COMMENT ON COLUMN partners.username IS
  'Copied from approved application. Legacy partners may be null until repaired.';

-- RLS: registry is service-role only (no public policies).
ALTER TABLE partner_username_registry ENABLE ROW LEVEL SECURITY;

-- Partners may read their own row by auth_user_id (in addition to existing email/profile policies).
DROP POLICY IF EXISTS partners_select_own_auth_user ON partners;
CREATE POLICY partners_select_own_auth_user
  ON partners FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS partners_update_own_auth_user ON partners;
CREATE POLICY partners_update_own_auth_user
  ON partners FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS partner_referrals_select_own_auth_user ON partner_referrals;
CREATE POLICY partner_referrals_select_own_auth_user
  ON partner_referrals FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS partner_payouts_select_own_auth_user ON partner_payouts;
CREATE POLICY partner_payouts_select_own_auth_user
  ON partner_payouts FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE auth_user_id = auth.uid()
    )
  );

-- Authenticated applicants may read their own application by auth_user_id.
DROP POLICY IF EXISTS partner_applications_select_own_auth_user ON partner_applications;
CREATE POLICY partner_applications_select_own_auth_user
  ON partner_applications FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());
