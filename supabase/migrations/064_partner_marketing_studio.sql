-- Partner Marketing Studio: campaigns, assets, downloads, logos, storage.

-- Active partner logo uploads (one active logo per partner enforced in app)
CREATE TABLE IF NOT EXISTS partner_uploaded_logos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes integer NOT NULL CHECK (file_size_bytes > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_uploaded_logos_partner_idx
  ON partner_uploaded_logos (partner_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS partner_uploaded_logos_one_active_uidx
  ON partner_uploaded_logos (partner_id)
  WHERE is_active = true;

-- Campaign definitions
CREATE TABLE IF NOT EXISTS partner_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  name text NOT NULL,
  theme text NOT NULL,
  audience text NOT NULL,
  goal text NOT NULL,
  style text NOT NULL,
  platforms text[] NOT NULL DEFAULT '{}',
  referral_url text NOT NULL,
  referral_code text NOT NULL,
  copy_variant text NOT NULL DEFAULT 'professional',
  status text NOT NULL DEFAULT 'ready'
    CHECK (status IN ('generating', 'ready', 'archived')),
  -- Future analytics placeholders (not populated yet)
  clicks_count integer NOT NULL DEFAULT 0,
  signups_count integer NOT NULL DEFAULT 0,
  qualified_referrals_count integer NOT NULL DEFAULT 0,
  revenue_earned_cad numeric(10, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_campaigns_partner_idx
  ON partner_campaigns (partner_id, created_at DESC);

-- Generated / linked assets per campaign platform
CREATE TABLE IF NOT EXISTS partner_campaign_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES partner_campaigns (id) ON DELETE CASCADE,
  platform text NOT NULL,
  asset_kind text NOT NULL
    CHECK (asset_kind IN ('graphic', 'email', 'print', 'qr', 'banner')),
  title text NOT NULL,
  preview_src text,
  download_href text,
  download_file_name text,
  secondary_download_href text,
  secondary_download_file_name text,
  caption text,
  post_body text,
  email_html text,
  email_text text,
  email_subject text,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_campaign_assets_campaign_idx
  ON partner_campaign_assets (campaign_id, sort_order);

-- Download audit log (optional analytics foundation)
CREATE TABLE IF NOT EXISTS partner_campaign_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES partner_campaigns (id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  asset_id uuid REFERENCES partner_campaign_assets (id) ON DELETE SET NULL,
  download_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_campaign_downloads_campaign_idx
  ON partner_campaign_downloads (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_campaign_downloads_partner_idx
  ON partner_campaign_downloads (partner_id, created_at DESC);

ALTER TABLE partner_uploaded_logos ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_campaign_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_campaign_downloads ENABLE ROW LEVEL SECURITY;

-- Ownership helper: partner rows for current auth user
-- Policies use auth_user_id (preferred) + legacy email/profile fallbacks.

DROP POLICY IF EXISTS partner_uploaded_logos_select_own ON partner_uploaded_logos;
CREATE POLICY partner_uploaded_logos_select_own
  ON partner_uploaded_logos FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners
      WHERE auth_user_id = auth.uid()
         OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS partner_uploaded_logos_insert_own ON partner_uploaded_logos;
CREATE POLICY partner_uploaded_logos_insert_own
  ON partner_uploaded_logos FOR INSERT
  TO authenticated
  WITH CHECK (
    partner_id IN (
      SELECT id FROM partners
      WHERE auth_user_id = auth.uid()
         OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS partner_uploaded_logos_update_own ON partner_uploaded_logos;
CREATE POLICY partner_uploaded_logos_update_own
  ON partner_uploaded_logos FOR UPDATE
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners
      WHERE auth_user_id = auth.uid()
         OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    partner_id IN (
      SELECT id FROM partners
      WHERE auth_user_id = auth.uid()
         OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS partner_uploaded_logos_delete_own ON partner_uploaded_logos;
CREATE POLICY partner_uploaded_logos_delete_own
  ON partner_uploaded_logos FOR DELETE
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners
      WHERE auth_user_id = auth.uid()
         OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS partner_campaigns_select_own ON partner_campaigns;
CREATE POLICY partner_campaigns_select_own
  ON partner_campaigns FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners
      WHERE auth_user_id = auth.uid()
         OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS partner_campaigns_insert_own ON partner_campaigns;
CREATE POLICY partner_campaigns_insert_own
  ON partner_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    partner_id IN (
      SELECT id FROM partners
      WHERE auth_user_id = auth.uid()
         OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS partner_campaigns_update_own ON partner_campaigns;
CREATE POLICY partner_campaigns_update_own
  ON partner_campaigns FOR UPDATE
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners
      WHERE auth_user_id = auth.uid()
         OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    partner_id IN (
      SELECT id FROM partners
      WHERE auth_user_id = auth.uid()
         OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS partner_campaign_assets_select_own ON partner_campaign_assets;
CREATE POLICY partner_campaign_assets_select_own
  ON partner_campaign_assets FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT c.id FROM partner_campaigns c
      JOIN partners p ON p.id = c.partner_id
      WHERE p.auth_user_id = auth.uid()
         OR lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR p.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS partner_campaign_assets_insert_own ON partner_campaign_assets;
CREATE POLICY partner_campaign_assets_insert_own
  ON partner_campaign_assets FOR INSERT
  TO authenticated
  WITH CHECK (
    campaign_id IN (
      SELECT c.id FROM partner_campaigns c
      JOIN partners p ON p.id = c.partner_id
      WHERE p.auth_user_id = auth.uid()
         OR lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR p.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS partner_campaign_assets_update_own ON partner_campaign_assets;
CREATE POLICY partner_campaign_assets_update_own
  ON partner_campaign_assets FOR UPDATE
  TO authenticated
  USING (
    campaign_id IN (
      SELECT c.id FROM partner_campaigns c
      JOIN partners p ON p.id = c.partner_id
      WHERE p.auth_user_id = auth.uid()
         OR lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR p.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    campaign_id IN (
      SELECT c.id FROM partner_campaigns c
      JOIN partners p ON p.id = c.partner_id
      WHERE p.auth_user_id = auth.uid()
         OR lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR p.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS partner_campaign_downloads_select_own ON partner_campaign_downloads;
CREATE POLICY partner_campaign_downloads_select_own
  ON partner_campaign_downloads FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners
      WHERE auth_user_id = auth.uid()
         OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS partner_campaign_downloads_insert_own ON partner_campaign_downloads;
CREATE POLICY partner_campaign_downloads_insert_own
  ON partner_campaign_downloads FOR INSERT
  TO authenticated
  WITH CHECK (
    partner_id IN (
      SELECT id FROM partners
      WHERE auth_user_id = auth.uid()
         OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
         OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Private storage for partner logos (path: partner_id/filename)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'partner-logos',
  'partner-logos',
  false,
  5242880,
  ARRAY['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS partner_logos_upload_own ON storage.objects;
CREATE POLICY partner_logos_upload_own
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'partner-logos'
    AND EXISTS (
      SELECT 1 FROM public.partners p
      WHERE (storage.foldername(name))[1] = p.id::text
        AND (
          p.auth_user_id = auth.uid()
          OR lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          OR p.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS partner_logos_read_own ON storage.objects;
CREATE POLICY partner_logos_read_own
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'partner-logos'
    AND EXISTS (
      SELECT 1 FROM public.partners p
      WHERE (storage.foldername(name))[1] = p.id::text
        AND (
          p.auth_user_id = auth.uid()
          OR lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          OR p.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS partner_logos_update_own ON storage.objects;
CREATE POLICY partner_logos_update_own
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'partner-logos'
    AND EXISTS (
      SELECT 1 FROM public.partners p
      WHERE (storage.foldername(name))[1] = p.id::text
        AND (
          p.auth_user_id = auth.uid()
          OR lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          OR p.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS partner_logos_delete_own ON storage.objects;
CREATE POLICY partner_logos_delete_own
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'partner-logos'
    AND EXISTS (
      SELECT 1 FROM public.partners p
      WHERE (storage.foldername(name))[1] = p.id::text
        AND (
          p.auth_user_id = auth.uid()
          OR lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          OR p.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

COMMENT ON TABLE partner_campaigns IS
  'Partner Marketing Studio campaigns. Analytics columns are placeholders for a future release.';
COMMENT ON TABLE partner_uploaded_logos IS
  'Partner company logos for Marketing Studio personalization.';
