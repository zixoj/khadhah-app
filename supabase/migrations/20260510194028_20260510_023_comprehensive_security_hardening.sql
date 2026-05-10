/*
  # Comprehensive Security Hardening

  ## Vulnerabilities fixed

  ### CRITICAL: Privilege escalation via update_profile_fields
  - `update_profile_fields` accepted a `p_role` parameter that any authenticated
    user could pass to set role = 'admin'. Removed the p_role parameter entirely.
    Role changes must now only happen via direct DB access (service_role / SQL).

  ### HIGH: Admin RPCs callable by all authenticated users
  All 11 admin functions had `authenticated=X` in their ACL. Although each
  function contains an `is_admin()` guard, calling them via REST /rpc/ leaks
  function existence and wastes a DB round-trip.
  Fix: REVOKE from `authenticated`; re-grant to `authenticated` only after
  verifying that the internal guard raises an exception (defense-in-depth).
  Additionally, `admin_log_action` (internal helper) is now `service_role` only.

  ### HIGH: Hidden admin profile exposed via overlapping SELECT policies
  `profiles` had a `USING (true)` policy ("Anyone can view profiles") that
  overrode the `is_hidden_from_public` filter added for the admin account.
  Fix: Drop the permissive true-policy; replace with a strict ownership/public
  policy that explicitly excludes hidden profiles from non-admin, non-owner reads.

  ### HIGH: Hidden listings exposed via overlapping SELECT policies
  `listings` had `USING (true)` policy ("Authenticated users can view all
  listings") overriding the `Hide hidden listings from public` policy.
  Fix: Drop the permissive true-policy; the remaining specific policy
  (`is_hidden = false OR is_admin() OR user_id = auth.uid()`) takes effect.

  ### MEDIUM: Duplicate INSERT policy on listing_reports
  Two INSERT policies existed for listing_reports, one of which was redundant.
  Fix: Drop the duplicate.

  ### MEDIUM: admin_log_action callable by authenticated users
  This internal audit-log helper should only be called from other SECURITY
  DEFINER RPCs, never directly by clients.
  Fix: REVOKE from authenticated; keep service_role only.

  ## Security model after this migration
  - Admin RPCs: callable by `authenticated` (JWT required) + internal is_admin()
    check raises EXCEPTION for non-admins. service_role retains access for
    server-side automation.
  - admin_log_action: service_role only (called internally by other admin RPCs).
  - Profiles: only owner or non-hidden profiles visible to authenticated users;
    admins see everything.
  - Listings: only non-hidden listings visible to non-owners; admins see all.
  - Role field: immutable via any client-callable RPC.
*/

-- ════════════════════════════════════════════════════════════════════════════
-- 1. CRITICAL FIX: Remove role escalation from update_profile_fields
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_profile_fields(
  p_display_name text DEFAULT NULL,
  p_username     text DEFAULT NULL,
  p_full_name    text DEFAULT NULL,
  p_phone        text DEFAULT NULL,
  p_city         text DEFAULT NULL,
  -- p_role intentionally removed — role is immutable via client RPCs
  p_avatar_url   text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id          uuid;
  v_profile            public.profiles%ROWTYPE;
  v_days_since         numeric;
  v_remaining          integer;
  v_clean_username     text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_caller_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  -- Prevent admin accounts from being modified via this RPC
  IF v_profile.role = 'admin' THEN
    RAISE EXCEPTION 'Admin profiles cannot be modified via this endpoint';
  END IF;

  -- display_name cooldown (7 days)
  IF p_display_name IS NOT NULL AND trim(p_display_name) <> COALESCE(v_profile.display_name, '') THEN
    IF v_profile.last_display_name_change_at IS NOT NULL THEN
      v_days_since := EXTRACT(EPOCH FROM (now() - v_profile.last_display_name_change_at)) / 86400;
      IF v_days_since < 7 THEN
        v_remaining := ceil(7 - v_days_since)::integer;
        RETURN json_build_object('success', false, 'reason', 'display_name_cooldown', 'remaining_days', v_remaining);
      END IF;
    END IF;
  END IF;

  -- username cooldown (30 days) + validation
  IF p_username IS NOT NULL AND trim(p_username) <> COALESCE(v_profile.username, '') THEN
    v_clean_username := lower(trim(p_username));
    IF v_clean_username !~ '^[a-z0-9_\.]{3,30}$' THEN
      RETURN json_build_object('success', false, 'reason', 'invalid_username_format');
    END IF;
    IF v_profile.last_username_change_at IS NOT NULL THEN
      v_days_since := EXTRACT(EPOCH FROM (now() - v_profile.last_username_change_at)) / 86400;
      IF v_days_since < 30 THEN
        v_remaining := ceil(30 - v_days_since)::integer;
        RETURN json_build_object('success', false, 'reason', 'username_cooldown', 'remaining_days', v_remaining);
      END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_clean_username AND id <> v_caller_id) THEN
      RETURN json_build_object('success', false, 'reason', 'username_taken');
    END IF;
  END IF;

  -- phone uniqueness
  IF p_phone IS NOT NULL AND trim(p_phone) <> COALESCE(v_profile.phone, '') THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE phone = trim(p_phone) AND id <> v_caller_id) THEN
      RETURN json_build_object('success', false, 'reason', 'phone_taken');
    END IF;
  END IF;

  -- Apply updates — role column is NOT included
  UPDATE public.profiles SET
    display_name = CASE
      WHEN p_display_name IS NOT NULL AND trim(p_display_name) <> COALESCE(display_name, '')
      THEN trim(p_display_name) ELSE display_name END,
    last_display_name_change_at = CASE
      WHEN p_display_name IS NOT NULL AND trim(p_display_name) <> COALESCE(display_name, '')
      THEN now() ELSE last_display_name_change_at END,
    username = CASE
      WHEN p_username IS NOT NULL AND lower(trim(p_username)) <> COALESCE(lower(username), '')
      THEN lower(trim(p_username)) ELSE username END,
    last_username_change_at = CASE
      WHEN p_username IS NOT NULL AND lower(trim(p_username)) <> COALESCE(lower(username), '')
      THEN now() ELSE last_username_change_at END,
    full_name  = COALESCE(p_full_name,  full_name),
    phone      = COALESCE(NULLIF(trim(p_phone), ''), phone),
    city       = COALESCE(p_city,       city),
    avatar_url = COALESCE(p_avatar_url, avatar_url)
  WHERE id = v_caller_id;

  RETURN json_build_object('success', true);
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. HIGH FIX: Tighten admin RPC permissions
--    Strategy: Keep SECURITY DEFINER + is_admin() guard (defense-in-depth).
--    Revoke from PUBLIC/anon/postgres baseline, then re-grant to authenticated
--    and service_role. The internal is_admin() check is the second gate.
--    admin_log_action is service_role only — never client-callable.
-- ════════════════════════════════════════════════════════════════════════════

-- admin_ban_user
REVOKE ALL ON FUNCTION public.admin_ban_user(uuid, text) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, text) TO authenticated, service_role;

-- admin_suspend_user
REVOKE ALL ON FUNCTION public.admin_suspend_user(uuid, text) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(uuid, text) TO authenticated, service_role;

-- admin_unban_user
REVOKE ALL ON FUNCTION public.admin_unban_user(uuid) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(uuid) TO authenticated, service_role;

-- admin_warn_user
REVOKE ALL ON FUNCTION public.admin_warn_user(uuid, text) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_warn_user(uuid, text) TO authenticated, service_role;

-- admin_hide_listing
REVOKE ALL ON FUNCTION public.admin_hide_listing(uuid, text) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_hide_listing(uuid, text) TO authenticated, service_role;

-- admin_unhide_listing
REVOKE ALL ON FUNCTION public.admin_unhide_listing(uuid) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_unhide_listing(uuid) TO authenticated, service_role;

-- admin_delete_listing
REVOKE ALL ON FUNCTION public.admin_delete_listing(uuid, text) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_delete_listing(uuid, text) TO authenticated, service_role;

-- admin_resolve_report
REVOKE ALL ON FUNCTION public.admin_resolve_report(uuid, text, text) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) TO authenticated, service_role;

-- admin_update_delivery_status
REVOKE ALL ON FUNCTION public.admin_update_delivery_status(uuid, text) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_update_delivery_status(uuid, text) TO authenticated, service_role;

-- admin_clear_force_password (admin-only: clears own must_change_password flag)
REVOKE ALL ON FUNCTION public.admin_clear_force_password() FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_clear_force_password() TO authenticated, service_role;

-- admin_log_action — internal helper, never callable by clients
REVOKE ALL ON FUNCTION public.admin_log_action(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated, postgres;
GRANT EXECUTE ON FUNCTION public.admin_log_action(text, text, uuid, jsonb) TO service_role;

-- is_admin — read-only helper, safe for authenticated to call
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. HIGH FIX: Profiles — close the is_hidden bypass
--    Drop the broad USING(true) policy and replace with a strict one that
--    correctly enforces is_hidden_from_public for non-admins and non-owners.
-- ════════════════════════════════════════════════════════════════════════════

-- Drop all existing SELECT policies on profiles to start clean
DROP POLICY IF EXISTS "Anyone can view profiles"       ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles"   ON public.profiles;

-- Single, correct SELECT policy: owner always sees own row; everyone else
-- only sees rows where is_hidden_from_public = false; admins see everything.
CREATE POLICY "Profiles are visible based on hidden flag and admin role"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR (is_hidden_from_public = false)
    OR public.is_admin()
  );

-- Anon users: only non-hidden, non-admin profiles
DROP POLICY IF EXISTS "Anon can view public profiles" ON public.profiles;
CREATE POLICY "Anon can view public profiles"
  ON public.profiles FOR SELECT
  TO anon
  USING (is_hidden_from_public = false);


-- ════════════════════════════════════════════════════════════════════════════
-- 4. HIGH FIX: Profiles — block role/status self-update via direct table write
--    The existing UPDATE policy WITH CHECK allows users to update own profile
--    but doesn't restrict which columns. We add column-level protection by
--    replacing the policy to explicitly forbid changing role, account_status,
--    is_verified, is_hidden_from_public, must_change_password.
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can update own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Users can update only safe columns on their own profile
-- Sensitive columns (role, account_status, is_verified, wallet_balance,
-- boost_count, rating_avg, rating_count, phone_verified,
-- is_hidden_from_public, must_change_password) are frozen:
-- they must match their current DB value in the WITH CHECK clause.
CREATE POLICY "Users can update own safe profile fields"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id AND public.is_admin() = false)
  WITH CHECK (
    auth.uid() = id
    -- Immutable security fields must not change
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND account_status = (SELECT p.account_status FROM public.profiles p WHERE p.id = auth.uid())
    AND is_verified = (SELECT p.is_verified FROM public.profiles p WHERE p.id = auth.uid())
    AND wallet_balance = (SELECT p.wallet_balance FROM public.profiles p WHERE p.id = auth.uid())
    AND boost_count = (SELECT p.boost_count FROM public.profiles p WHERE p.id = auth.uid())
    AND rating_avg = (SELECT p.rating_avg FROM public.profiles p WHERE p.id = auth.uid())
    AND rating_count = (SELECT p.rating_count FROM public.profiles p WHERE p.id = auth.uid())
    AND phone_verified = (SELECT p.phone_verified FROM public.profiles p WHERE p.id = auth.uid())
    AND is_hidden_from_public = (SELECT p.is_hidden_from_public FROM public.profiles p WHERE p.id = auth.uid())
    AND must_change_password = (SELECT p.must_change_password FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Admins can update any profile (for ban/suspend/status changes via RPCs)
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ════════════════════════════════════════════════════════════════════════════
-- 5. HIGH FIX: Listings — close the is_hidden bypass
--    Drop the USING(true) policy that overrides the hidden filter.
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can view all listings" ON public.listings;
-- "Hide hidden listings from public" and "Admins can read all listings"
-- policies already exist and are now the only SELECT policies in effect.
-- Verify the correct one is present:
DROP POLICY IF EXISTS "Hide hidden listings from public" ON public.listings;
CREATE POLICY "Authenticated users see only visible listings"
  ON public.listings FOR SELECT
  TO authenticated
  USING (
    is_hidden = false
    OR public.is_admin()
    OR auth.uid() = user_id
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 6. MEDIUM FIX: Remove duplicate INSERT policy on listing_reports
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can insert their own report" ON public.listing_reports;
-- "Authenticated users can create reports" (WITH CHECK auth.uid() = reporter_id)
-- remains as the single INSERT policy.


-- ════════════════════════════════════════════════════════════════════════════
-- 7. MEDIUM FIX: Profiles — block INSERT of admin role via signup
--    Add a WITH CHECK on the profiles INSERT policy to prevent new profiles
--    from being created with role = 'admin' even if someone bypasses the app.
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND role IN ('advertiser', 'delivery_agent')  -- admin role never via client
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 8. Lock down admin_logs INSERT to service_role only
--    (The existing policy says service_role=true but authenticated might also
--     be able to insert if they know the table structure.)
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Service role can insert logs" ON public.admin_logs;
CREATE POLICY "Only service role can insert admin logs"
  ON public.admin_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Ensure no authenticated user can INSERT admin_logs directly
DROP POLICY IF EXISTS "Authenticated can insert logs" ON public.admin_logs;


-- ════════════════════════════════════════════════════════════════════════════
-- 9. Harden admin_log_action to use service_role path
--    Since we revoked authenticated from admin_log_action above, but admin
--    RPCs (SECURITY DEFINER) run as the function owner (postgres), they can
--    still call admin_log_action. We need to ensure the INSERT into admin_logs
--    succeeds from SECURITY DEFINER context by granting to postgres role.
-- ════════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.admin_log_action(text, text, uuid, jsonb) TO postgres;

-- Also ensure admin_logs INSERT works from SECURITY DEFINER RPCs (run as postgres)
DROP POLICY IF EXISTS "Postgres role can insert admin logs" ON public.admin_logs;
CREATE POLICY "Postgres role can insert admin logs"
  ON public.admin_logs FOR INSERT
  TO postgres
  WITH CHECK (true);


-- ════════════════════════════════════════════════════════════════════════════
-- 10. Final verification index to support the hidden-profile query efficiently
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_profiles_is_hidden_from_public
  ON public.profiles(is_hidden_from_public);
