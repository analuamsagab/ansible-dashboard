-- ============================================================
-- Fix: 500 / 403 errors — infinite recursion + missing defaults
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- 1. Add DEFAULT auth.uid() to all user_id columns
ALTER TABLE target_servers ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE ansible_jobs   ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE playbooks      ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 2. Create SECURITY DEFINER function to bypass RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 3. Drop ALL existing policies before recreating

-- target_servers
DROP POLICY IF EXISTS "users_manage_own_servers" ON target_servers;
DROP POLICY IF EXISTS "users_select_own_servers" ON target_servers;
DROP POLICY IF EXISTS "users_insert_own_servers" ON target_servers;
DROP POLICY IF EXISTS "users_update_own_servers" ON target_servers;
DROP POLICY IF EXISTS "users_delete_own_servers" ON target_servers;

-- ansible_jobs
DROP POLICY IF EXISTS "users_manage_own_jobs" ON ansible_jobs;

-- playbooks
DROP POLICY IF EXISTS "users_manage_own_playbooks" ON playbooks;
DROP POLICY IF EXISTS "users_update_own_playbooks" ON playbooks;
DROP POLICY IF EXISTS "users_delete_own_playbooks" ON playbooks;
DROP POLICY IF EXISTS "read_playbooks" ON playbooks;

-- job_logs
DROP POLICY IF EXISTS "read_job_logs" ON job_logs;

-- profiles
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;

-- 4. Profiles policies
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 5. target_servers policies
CREATE POLICY "users_select_own_servers" ON target_servers
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "users_insert_own_servers" ON target_servers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_servers" ON target_servers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_servers" ON target_servers
  FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- 6. playbooks policies
CREATE POLICY "read_playbooks" ON playbooks
  FOR SELECT
  USING (
    is_system_default = true OR
    user_id = auth.uid() OR
    public.is_admin()
  );

CREATE POLICY "users_insert_own_playbooks" ON playbooks
  FOR INSERT
  WITH CHECK (
    (is_system_default = false AND user_id = auth.uid()) OR
    public.is_admin()
  );

CREATE POLICY "users_update_own_playbooks" ON playbooks
  FOR UPDATE
  USING (user_id = auth.uid() AND is_system_default = false)
  WITH CHECK (user_id = auth.uid() AND is_system_default = false);

CREATE POLICY "users_delete_own_playbooks" ON playbooks
  FOR DELETE
  USING ((user_id = auth.uid() AND is_system_default = false) OR public.is_admin());

-- 7. ansible_jobs policies
CREATE POLICY "users_manage_own_jobs" ON ansible_jobs
  FOR ALL
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid());

-- 8. job_logs policies (subquery now uses is_admin() instead of nested subquery)
CREATE POLICY "read_job_logs" ON job_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ansible_jobs aj
      WHERE aj.id = job_id
      AND (aj.user_id = auth.uid() OR public.is_admin())
    )
  );
