-- ══════════════════════════════════════════════════════════════
-- SECURITY FIX: Switch is_admin() from SECURITY DEFINER to
-- SECURITY INVOKER.
--
-- Reason: SECURITY DEFINER lets authenticated users call this
-- function via /rest/v1/rpc/is_admin with elevated (owner)
-- privileges. The function only reads public.profiles via
-- auth.uid() — no owner-level access is needed. SECURITY INVOKER
-- runs with the caller's own privileges, which are sufficient,
-- and removes the elevated-privilege exposure.
--
-- Impact: zero — authenticated users already have SELECT on
-- profiles, so all RLS policies that call is_admin() keep working.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = 'public', 'pg_temp'
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin'
);
$$;
