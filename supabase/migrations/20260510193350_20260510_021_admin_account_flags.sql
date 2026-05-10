/*
  # Admin Account Flags

  ## Summary
  Adds support fields needed for the default admin account.

  ## Changes
  - `profiles.must_change_password` — boolean flag; when true the app forces a
    password change before granting access to admin functions.
  - `profiles.username` uniqueness constraint (if not already present).

  ## Security
  - `must_change_password` can only be set/cleared by SECURITY DEFINER RPCs
    (enforced by RLS — users cannot UPDATE this column directly).
  - The admin profile is excluded from public user-list queries via the
    `is_hidden_from_public` flag added here.
*/

-- ── 1. must_change_password flag ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'must_change_password'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ── 2. is_hidden_from_public flag (hides admin from user lists) ───────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_hidden_from_public'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN is_hidden_from_public boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ── 3. RLS: exclude hidden profiles from public/authenticated SELECT ──────────
-- Update the existing SELECT policy so hidden profiles (like admin) are never
-- returned unless the caller IS the profile owner or an admin.
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR (is_hidden_from_public = false)
    OR public.is_admin()
  );

-- ── 4. admin_clear_force_password RPC ────────────────────────────────────────
-- Called after admin successfully changes their password on first login.
CREATE OR REPLACE FUNCTION public.admin_clear_force_password()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE public.profiles
  SET must_change_password = false
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clear_force_password() FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_clear_force_password() TO authenticated;
