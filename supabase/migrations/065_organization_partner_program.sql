-- Organization Partner Program profiles (extends applications/partners; no referral logic changes)

CREATE TABLE IF NOT EXISTS organization_partner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES partner_applications (id) ON DELETE SET NULL,
  partner_id uuid UNIQUE REFERENCES partners (id) ON DELETE CASCADE,
  organization_type text NOT NULL,
  job_title text,
  member_count text,
  primary_industries text,
  geographic_coverage text,
  newsletter_size text,
  social_audience text,
  website_traffic text,
  promotion_channels text[] NOT NULL DEFAULT '{}',
  interests text[] NOT NULL DEFAULT '{}',
  additional_comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_partner_profiles_application_idx
  ON organization_partner_profiles (application_id)
  WHERE application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS organization_partner_profiles_partner_idx
  ON organization_partner_profiles (partner_id)
  WHERE partner_id IS NOT NULL;

ALTER TABLE organization_partner_profiles ENABLE ROW LEVEL SECURITY;

-- Partners may read their own organization profile only.
CREATE POLICY organization_partner_profiles_select_own
  ON organization_partner_profiles
  FOR SELECT
  TO authenticated
  USING (
    partner_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM partners p
      WHERE p.id = organization_partner_profiles.partner_id
        AND p.auth_user_id = auth.uid()
        AND p.status = 'active'
    )
  );

-- Inserts/updates are performed by service role during apply/approve.
-- No authenticated write policies (matches partner_applications pattern).
