-- ============================================================
-- Fix: 500 Internal Server Error on target_servers
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add DEFAULT auth.uid() to user_id column
ALTER TABLE target_servers ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 2. Drop the broken monolithic policy
DROP POLICY IF EXISTS "users_manage_own_servers" ON target_servers;

-- 3. Create granular policies for each operation
CREATE POLICY "users_select_own_servers" ON target_servers
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "users_insert_own_servers" ON target_servers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_servers" ON target_servers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_servers" ON target_servers
  FOR DELETE
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
