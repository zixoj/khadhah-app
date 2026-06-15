-- ============================================================
-- Comprehensive admin full-access policies
-- ============================================================

-- Helper: verify is_admin() function exists and is correct
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ── listings: admin full CRUD ──────────────────────────────
DROP POLICY IF EXISTS "Admins can update any listing" ON public.listings;
CREATE POLICY "Admins can update any listing"
  ON public.listings FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any listing" ON public.listings;
CREATE POLICY "Admins can delete any listing"
  ON public.listings FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ── profiles: admin can see ALL fields including phone/country ──
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ── post_images: admin can delete ─────────────────────────────
DROP POLICY IF EXISTS "Admins can delete any post image" ON public.post_images;
CREATE POLICY "Admins can delete any post image"
  ON public.post_images FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all post images" ON public.post_images;
CREATE POLICY "Admins can read all post images"
  ON public.post_images FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ── chat_rooms: admin can delete ──────────────────────────────
DROP POLICY IF EXISTS "Admins can delete chat rooms" ON public.chat_rooms;
CREATE POLICY "Admins can delete chat rooms"
  ON public.chat_rooms FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ── admin_logs: admin authenticated insert ────────────────────
DROP POLICY IF EXISTS "Admins can insert admin logs" ON public.admin_logs;
CREATE POLICY "Admins can insert admin logs"
  ON public.admin_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND admin_id = auth.uid());

-- ── activity_log: admin can read all ─────────────────────────
DROP POLICY IF EXISTS "Admins can read all activity" ON public.activity_log;
CREATE POLICY "Admins can read all activity"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ── wallet_transactions: admin read only ──────────────────────
DROP POLICY IF EXISTS "Admins can read all wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Admins can read all wallet transactions"
  ON public.wallet_transactions FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ── ratings: admin read + delete ──────────────────────────────
DROP POLICY IF EXISTS "Admins can read all ratings" ON public.ratings;
CREATE POLICY "Admins can read all ratings"
  ON public.ratings FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete ratings" ON public.ratings;
CREATE POLICY "Admins can delete ratings"
  ON public.ratings FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ── delivery_requests: admin full read ────────────────────────
DROP POLICY IF EXISTS "Admins can read all delivery requests" ON public.delivery_requests;
CREATE POLICY "Admins can read all delivery requests"
  ON public.delivery_requests FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ── favorites: admin read ──────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read all favorites" ON public.favorites;
CREATE POLICY "Admins can read all favorites"
  ON public.favorites FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ── user_blocks: admin read + delete ──────────────────────────
DROP POLICY IF EXISTS "Admins can read user blocks" ON public.user_blocks;
CREATE POLICY "Admins can read user blocks"
  ON public.user_blocks FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Ensure admin role can NEVER be self-assigned via any RPC
-- (already enforced in update_profile_fields, just add a belt-and-suspenders DB check)
DROP POLICY IF EXISTS "Prevent self-promotion to admin via direct update" ON public.profiles;
CREATE POLICY "Prevent self-promotion to admin via direct update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    -- Non-admins cannot set role to admin
    (NOT public.is_admin() AND role <> 'admin')
    OR public.is_admin()
  );
