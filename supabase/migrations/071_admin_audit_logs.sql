-- Admin audit log: append-only record of sensitive administrative mutations.
--
-- Written ONLY by server code using the service-role key (src/lib/admin-audit-log.ts)
-- after an admin mutation succeeds. Browser clients (anon / authenticated) have no
-- grants and no RLS policies, so they can neither read nor insert audit rows.
--
-- Stores: admin identity (email), action, target type/id, timestamp and small, safe,
-- structured metadata. It must never contain passwords, tokens, reset links, payment
-- credentials, private documents or free-text personal data.
--
-- Safe to run once; every statement is idempotent. NOT applied automatically.

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  admin_email text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  -- Optional de-duplication key for one-shot actions (e.g. "partner_application_approved:<id>").
  -- A retried request hits the unique index instead of writing a second record.
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT admin_audit_logs_action_not_blank CHECK (length(btrim(action)) > 0),
  CONSTRAINT admin_audit_logs_target_not_blank CHECK (
    length(btrim(target_type)) > 0 AND length(btrim(target_id)) > 0
  ),
  CONSTRAINT admin_audit_logs_metadata_is_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT admin_audit_logs_metadata_size CHECK (pg_column_size(metadata) <= 4096)
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_audit_logs_idempotency_uidx
  ON public.admin_audit_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx
  ON public.admin_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx
  ON public.admin_audit_logs (target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_idx
  ON public.admin_audit_logs (admin_email, created_at DESC);

COMMENT ON TABLE public.admin_audit_logs IS
  'Append-only audit trail of admin mutations. Service-role writes only; no client access.';

-- RLS on with deliberately NO policies: anon/authenticated can do nothing.
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_audit_logs FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_audit_logs FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_audit_logs TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.admin_audit_logs FROM service_role;

-- Append-only enforcement, even for privileged roles that bypass RLS.
CREATE OR REPLACE FUNCTION public.admin_audit_logs_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_logs is append-only (% not allowed)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

-- Trigger functions cannot be called directly, but keep the function out of every API role's
-- reach anyway (PostgREST exposes the public schema).
REVOKE ALL ON FUNCTION public.admin_audit_logs_block_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS admin_audit_logs_no_update_delete ON public.admin_audit_logs;
CREATE TRIGGER admin_audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON public.admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.admin_audit_logs_block_mutation();

DROP TRIGGER IF EXISTS admin_audit_logs_no_truncate ON public.admin_audit_logs;
CREATE TRIGGER admin_audit_logs_no_truncate
  BEFORE TRUNCATE ON public.admin_audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.admin_audit_logs_block_mutation();
