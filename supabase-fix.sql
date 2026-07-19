-- ============================================================
-- Ansible Dashboard — Complete Supabase Setup
-- ============================================================
-- Run this entire file in Supabase SQL Editor once.
-- It is idempotent: safe to re-run multiple times.
-- ============================================================

-- ============================================================
-- 1. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 2. Enum types
-- ============================================================
DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('pending', 'running', 'success', 'failed', 'timeout');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. Create tables
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  full_name   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.target_servers (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  friendly_name          text NOT NULL,
  ip_address             text NOT NULL,
  ssh_port               integer NOT NULL DEFAULT 22,
  ssh_user               text NOT NULL DEFAULT 'root',
  encrypted_ssh_key      text,
  encrypted_ssh_password text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.playbooks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  content_yaml      text NOT NULL,
  is_system_default boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ansible_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  server_id   uuid NOT NULL REFERENCES public.target_servers(id) ON DELETE CASCADE,
  playbook_id uuid NOT NULL REFERENCES public.playbooks(id) ON DELETE RESTRICT,
  status      job_status NOT NULL DEFAULT 'pending',
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_logs (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  job_id      uuid NOT NULL REFERENCES public.ansible_jobs(id) ON DELETE CASCADE,
  log_line    text NOT NULL,
  stream      text NOT NULL DEFAULT 'stdout' CHECK (stream IN ('stdout', 'stderr', 'system')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. Add DEFAULT auth.uid() to all user_id columns
-- ============================================================
ALTER TABLE public.target_servers ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.ansible_jobs   ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.playbooks      ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ============================================================
-- 5. Auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    'user',
    NEW.raw_user_meta_data ->> 'full_name'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 6. is_admin() — bypass RLS recursion
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- ============================================================
-- 7. Drop ALL existing policies before recreating
-- ============================================================
DROP POLICY IF EXISTS "users_read_own_profile"    ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile"  ON public.profiles;
DROP POLICY IF EXISTS "admin_manage_profiles"     ON public.profiles;

DROP POLICY IF EXISTS "users_select_own_servers"  ON public.target_servers;
DROP POLICY IF EXISTS "users_insert_own_servers"  ON public.target_servers;
DROP POLICY IF EXISTS "users_update_own_servers"  ON public.target_servers;
DROP POLICY IF EXISTS "users_delete_own_servers"  ON public.target_servers;

DROP POLICY IF EXISTS "read_playbooks"            ON public.playbooks;
DROP POLICY IF EXISTS "users_insert_own_playbooks" ON public.playbooks;
DROP POLICY IF EXISTS "users_update_own_playbooks" ON public.playbooks;
DROP POLICY IF EXISTS "users_delete_own_playbooks" ON public.playbooks;

DROP POLICY IF EXISTS "users_manage_own_jobs"     ON public.ansible_jobs;

DROP POLICY IF EXISTS "read_job_logs"             ON public.job_logs;

-- ============================================================
-- 8. RLS policies — profiles
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "admin_manage_profiles" ON public.profiles
  FOR INSERT
  WITH CHECK (public.is_admin());

-- ============================================================
-- 9. RLS policies — target_servers
-- ============================================================
ALTER TABLE public.target_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_servers" ON public.target_servers
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "users_insert_own_servers" ON public.target_servers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_servers" ON public.target_servers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_servers" ON public.target_servers
  FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- 10. RLS policies — playbooks
-- ============================================================
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_playbooks" ON public.playbooks
  FOR SELECT
  USING (
    is_system_default = true OR
    user_id = auth.uid() OR
    public.is_admin()
  );

CREATE POLICY "users_insert_own_playbooks" ON public.playbooks
  FOR INSERT
  WITH CHECK (
    (is_system_default = false AND user_id = auth.uid()) OR
    public.is_admin()
  );

CREATE POLICY "users_update_own_playbooks" ON public.playbooks
  FOR UPDATE
  USING (user_id = auth.uid() AND is_system_default = false)
  WITH CHECK (user_id = auth.uid() AND is_system_default = false);

CREATE POLICY "users_delete_own_playbooks" ON public.playbooks
  FOR DELETE
  USING ((user_id = auth.uid() AND is_system_default = false) OR public.is_admin());

-- ============================================================
-- 11. RLS policies — ansible_jobs
-- ============================================================
ALTER TABLE public.ansible_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_jobs" ON public.ansible_jobs
  FOR ALL
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 12. RLS policies — job_logs
-- ============================================================
ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_job_logs" ON public.job_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ansible_jobs aj
      WHERE aj.id = job_id
      AND (aj.user_id = auth.uid() OR public.is_admin())
    )
  );

-- ============================================================
-- 13. Indexes for scalability
-- ============================================================

-- Job queries: filter by user + status, sort by date
CREATE INDEX IF NOT EXISTS idx_ansible_jobs_user_status
  ON public.ansible_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ansible_jobs_created_at
  ON public.ansible_jobs(created_at DESC);

-- Worker: fast lookup of pending jobs
CREATE INDEX IF NOT EXISTS idx_ansible_jobs_pending
  ON public.ansible_jobs(status)
  WHERE status = 'pending';

-- Job filtering by server
CREATE INDEX IF NOT EXISTS idx_ansible_jobs_server
  ON public.ansible_jobs(server_id);

-- Log streaming: paginate by job + time
CREATE INDEX IF NOT EXISTS idx_job_logs_job_created
  ON public.job_logs(job_id, created_at);

-- Server listing per user
CREATE INDEX IF NOT EXISTS idx_target_servers_user
  ON public.target_servers(user_id);

-- Playbook listing: user's playbooks + system defaults
CREATE INDEX IF NOT EXISTS idx_playbooks_user
  ON public.playbooks(user_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_system
  ON public.playbooks(is_system_default)
  WHERE is_system_default = true;

-- ============================================================
-- 14. Data retention — cleanup logs older than 30 days
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.job_logs
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
-- Schedule via pg_cron or external cron job:
--   SELECT cron.schedule('cleanup-job-logs', '0 3 * * 0', 'SELECT cleanup_old_logs();');

-- ============================================================
-- 15. Enable realtime publication for worker
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'ansible_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ansible_jobs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'job_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_logs;
  END IF;
END;
$$;

-- ============================================================
-- Done.
-- ============================================================
