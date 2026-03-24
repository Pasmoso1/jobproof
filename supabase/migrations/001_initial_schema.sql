-- JobProof Phase 1: Initial schema
-- Tables: profiles, customers, jobs, job_updates, job_update_attachments, storage_usage

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- profiles: one per auth user, created on signup
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type text NOT NULL DEFAULT 'solo' CHECK (plan_type IN ('solo', 'team', 'enterprise')),
  subscription_status text NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'past_due')),
  active_job_limit int NOT NULL DEFAULT 10 CHECK (active_job_limit >= 0),
  storage_limit_mb int NOT NULL DEFAULT 10240 CHECK (storage_limit_mb >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);

-- customers: belong to a profile
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_profile_id ON public.customers(profile_id);

-- jobs: belong to a profile and customer
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  address text,
  price numeric(12, 2),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_profile_id ON public.jobs(profile_id);
CREATE INDEX idx_jobs_customer_id ON public.jobs(customer_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at DESC);

-- job_updates: timeline entries for a job
CREATE TABLE public.job_updates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('before', 'during', 'after', 'other')),
  title text NOT NULL,
  note text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_updates_job_id ON public.job_updates(job_id);
CREATE INDEX idx_job_updates_date ON public.job_updates(date DESC);

-- job_update_attachments: files linked to a job_update
CREATE TABLE public.job_update_attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_update_id uuid NOT NULL REFERENCES public.job_updates(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_update_attachments_job_update_id ON public.job_update_attachments(job_update_id);

-- storage_usage: per-profile storage tracking
CREATE TABLE public.storage_usage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_bytes bigint NOT NULL DEFAULT 0 CHECK (total_bytes >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_storage_usage_profile_id ON public.storage_usage(profile_id);

-- Trigger: create profile when new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, plan_type, subscription_status, active_job_limit, storage_limit_mb)
  VALUES (
    NEW.id,
    'solo',
    'trial',
    10,
    10240
  );
  INSERT INTO public.storage_usage (profile_id)
  SELECT id FROM public.profiles WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: updated_at for profiles
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER job_updates_updated_at
  BEFORE UPDATE ON public.job_updates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: Enable on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_update_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_usage ENABLE ROW LEVEL SECURITY;

-- RLS: profiles - users can read/update own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS: customers - users can CRUD own customers (via profile)
CREATE POLICY "Users can manage own customers"
  ON public.customers FOR ALL
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- RLS: jobs - users can CRUD own jobs
CREATE POLICY "Users can manage own jobs"
  ON public.jobs FOR ALL
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- RLS: job_updates - users can CRUD via job ownership
CREATE POLICY "Users can manage own job updates"
  ON public.job_updates FOR ALL
  USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.profiles p ON j.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.profiles p ON j.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS: job_update_attachments - users can CRUD via job_update ownership
CREATE POLICY "Users can manage own job update attachments"
  ON public.job_update_attachments FOR ALL
  USING (
    job_update_id IN (
      SELECT ju.id FROM public.job_updates ju
      JOIN public.jobs j ON ju.job_id = j.id
      JOIN public.profiles p ON j.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    job_update_id IN (
      SELECT ju.id FROM public.job_updates ju
      JOIN public.jobs j ON ju.job_id = j.id
      JOIN public.profiles p ON j.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS: storage_usage - users can read/update own
CREATE POLICY "Users can view own storage usage"
  ON public.storage_usage FOR SELECT
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own storage usage"
  ON public.storage_usage FOR UPDATE
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Storage bucket for job attachments (create via Supabase dashboard or API; policy here)
-- Bucket: job-attachments, private, RLS via storage policies
