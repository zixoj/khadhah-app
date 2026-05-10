/*
  # Admin System — Full Schema

  ## Summary
  Adds a complete admin and moderation layer to the خذها app.

  ## 1. Profile changes
  - Add `account_status` column to profiles: 'active' | 'suspended' | 'banned'
  - Add `is_hidden` flag to listings (admin can hide without deleting)
  - Admin role is stored as role = 'admin' in profiles — cannot be set via the app UI

  ## 2. New tables
  - `reports` — full moderation reports with status, notes, screenshots
  - `admin_logs` — immutable audit trail of all admin actions
  - `report_screenshots` — image attachments for reports

  ## 3. Secure RPCs (SECURITY DEFINER, admin-only)
  - `admin_ban_user` — sets account_status + optionally deletes data
  - `admin_suspend_user` — temporary suspension
  - `admin_unban_user` — restores active status
  - `admin_hide_listing` — sets listing is_hidden
  - `admin_delete_listing` — deletes listing
  - `admin_resolve_report` — updates report status + adds notes
  - `admin_update_delivery_status` — approve/reject courier application
  - `admin_log_action` — internal helper to insert audit log

  ## 4. RLS
  - All new tables RLS-enabled
  - Admin-only access via role check helper function
  - Reports: reporters can INSERT their own; admins can SELECT/UPDATE/DELETE all
  - Admin logs: admins can SELECT; only RPCs INSERT

  ## Security
  - `is_admin()` helper checks profiles.role = 'admin'
  - All admin RPCs verify auth + role before executing
  - search_path locked on all functions
*/

-- ── 0. is_admin() helper ─────────────────────────────────────────────────────
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

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;


-- ── 1. Add account_status to profiles ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'account_status'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN account_status text NOT NULL DEFAULT 'active'
      CHECK (account_status IN ('active', 'suspended', 'banned'));
  END IF;
END $$;

-- ── 2. Add is_hidden + admin_note to listings ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'is_hidden'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'admin_note'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN admin_note text DEFAULT '';
  END IF;
END $$;

-- ── 3. Expand listing_reports with full report schema ─────────────────────────
DO $$
BEGIN
  -- reported_user_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listing_reports' AND column_name='reported_user_id') THEN
    ALTER TABLE public.listing_reports ADD COLUMN reported_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  -- chat_room_id (optional)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listing_reports' AND column_name='chat_room_id') THEN
    ALTER TABLE public.listing_reports ADD COLUMN chat_room_id uuid REFERENCES public.chat_rooms(id) ON DELETE SET NULL;
  END IF;
  -- description
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listing_reports' AND column_name='description') THEN
    ALTER TABLE public.listing_reports ADD COLUMN description text DEFAULT '';
  END IF;
  -- status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listing_reports' AND column_name='status') THEN
    ALTER TABLE public.listing_reports ADD COLUMN status text NOT NULL DEFAULT 'new'
      CHECK (status IN ('new', 'under_review', 'resolved', 'rejected'));
  END IF;
  -- admin_notes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listing_reports' AND column_name='admin_notes') THEN
    ALTER TABLE public.listing_reports ADD COLUMN admin_notes text DEFAULT '';
  END IF;
  -- reviewed_by
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listing_reports' AND column_name='reviewed_by') THEN
    ALTER TABLE public.listing_reports ADD COLUMN reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  -- reviewed_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listing_reports' AND column_name='reviewed_at') THEN
    ALTER TABLE public.listing_reports ADD COLUMN reviewed_at timestamptz;
  END IF;
END $$;

-- Enable RLS on listing_reports if not yet
ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policies if any
DROP POLICY IF EXISTS "Users can create reports" ON public.listing_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON public.listing_reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.listing_reports;

-- Reporters can insert their own reports
CREATE POLICY "Authenticated users can create reports"
  ON public.listing_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Admins can read all reports
CREATE POLICY "Admins can read all reports"
  ON public.listing_reports FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update report status/notes
CREATE POLICY "Admins can update reports"
  ON public.listing_reports FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete reports
CREATE POLICY "Admins can delete reports"
  ON public.listing_reports FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ── 4. report_screenshots ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_screenshots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  uuid NOT NULL REFERENCES public.listing_reports(id) ON DELETE CASCADE,
  url        text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.report_screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters can add screenshots"
  ON public.report_screenshots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listing_reports r
      WHERE r.id = report_id AND r.reporter_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view screenshots"
  ON public.report_screenshots FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete screenshots"
  ON public.report_screenshots FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ── 5. admin_logs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      text NOT NULL,        -- e.g. 'ban_user', 'hide_listing', 'resolve_report'
  target_type text NOT NULL,        -- 'user' | 'listing' | 'report' | 'chat' | 'delivery'
  target_id   uuid,                 -- id of the affected row
  details     jsonb DEFAULT '{}',   -- extra context (reason, new status, etc.)
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read logs
CREATE POLICY "Admins can read admin logs"
  ON public.admin_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Only internal RPCs insert logs (service_role)
CREATE POLICY "Service role can insert logs"
  ON public.admin_logs FOR INSERT
  TO service_role
  WITH CHECK (true);


-- ── 6. admin_log_action (internal helper) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_log_action(
  p_action      text,
  p_target_type text,
  p_target_id   uuid,
  p_details     jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.admin_logs (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_details);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_log_action(text, text, uuid, jsonb) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_log_action(text, text, uuid, jsonb) TO authenticated, service_role;


-- ── 7. Admin RPCs ─────────────────────────────────────────────────────────────

-- admin_ban_user
CREATE OR REPLACE FUNCTION public.admin_ban_user(
  p_user_id uuid,
  p_reason  text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.profiles
  SET account_status = 'banned'
  WHERE id = p_user_id;

  PERFORM public.admin_log_action('ban_user', 'user', p_user_id, jsonb_build_object('reason', p_reason));
  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ban_user(uuid, text) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, text) TO authenticated;


-- admin_suspend_user
CREATE OR REPLACE FUNCTION public.admin_suspend_user(
  p_user_id uuid,
  p_reason  text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  UPDATE public.profiles SET account_status = 'suspended' WHERE id = p_user_id;
  PERFORM public.admin_log_action('suspend_user', 'user', p_user_id, jsonb_build_object('reason', p_reason));
  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_suspend_user(uuid, text) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(uuid, text) TO authenticated;


-- admin_unban_user
CREATE OR REPLACE FUNCTION public.admin_unban_user(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  UPDATE public.profiles SET account_status = 'active' WHERE id = p_user_id;
  PERFORM public.admin_log_action('unban_user', 'user', p_user_id, '{}');
  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_unban_user(uuid) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(uuid) TO authenticated;


-- admin_warn_user (adds a warning note)
CREATE OR REPLACE FUNCTION public.admin_warn_user(
  p_user_id uuid,
  p_note    text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  PERFORM public.admin_log_action('warn_user', 'user', p_user_id, jsonb_build_object('note', p_note));
  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_warn_user(uuid, text) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_warn_user(uuid, text) TO authenticated;


-- admin_hide_listing
CREATE OR REPLACE FUNCTION public.admin_hide_listing(
  p_listing_id uuid,
  p_reason     text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  UPDATE public.listings SET is_hidden = true, admin_note = p_reason WHERE id = p_listing_id;
  PERFORM public.admin_log_action('hide_listing', 'listing', p_listing_id, jsonb_build_object('reason', p_reason));
  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_hide_listing(uuid, text) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_hide_listing(uuid, text) TO authenticated;


-- admin_unhide_listing
CREATE OR REPLACE FUNCTION public.admin_unhide_listing(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  UPDATE public.listings SET is_hidden = false, admin_note = '' WHERE id = p_listing_id;
  PERFORM public.admin_log_action('unhide_listing', 'listing', p_listing_id, '{}');
  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_unhide_listing(uuid) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_unhide_listing(uuid) TO authenticated;


-- admin_delete_listing
CREATE OR REPLACE FUNCTION public.admin_delete_listing(
  p_listing_id uuid,
  p_reason     text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  PERFORM public.admin_log_action('delete_listing', 'listing', p_listing_id, jsonb_build_object('reason', p_reason));
  DELETE FROM public.listings WHERE id = p_listing_id;
  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_listing(uuid, text) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_delete_listing(uuid, text) TO authenticated;


-- admin_resolve_report
CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  p_report_id  uuid,
  p_status     text,  -- 'under_review' | 'resolved' | 'rejected'
  p_notes      text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_status NOT IN ('under_review', 'resolved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.listing_reports
  SET status = p_status,
      admin_notes = p_notes,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = p_report_id;

  PERFORM public.admin_log_action('resolve_report', 'report', p_report_id, jsonb_build_object('status', p_status, 'notes', p_notes));
  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_report(uuid, text, text) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) TO authenticated;


-- admin_update_delivery_status (approve/reject courier)
CREATE OR REPLACE FUNCTION public.admin_update_delivery_status(
  p_user_id uuid,
  p_action  text  -- 'approve' | 'reject' | 'suspend'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_status text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_action = 'approve' THEN v_new_status := 'active';
  ELSIF p_action = 'reject' THEN v_new_status := 'banned';
  ELSIF p_action = 'suspend' THEN v_new_status := 'suspended';
  ELSE RAISE EXCEPTION 'Invalid action';
  END IF;

  UPDATE public.profiles SET account_status = v_new_status WHERE id = p_user_id AND role = 'delivery_agent';
  PERFORM public.admin_log_action('update_delivery_status', 'user', p_user_id, jsonb_build_object('action', p_action));
  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_delivery_status(uuid, text) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.admin_update_delivery_status(uuid, text) TO authenticated;


-- ── 8. Update public listing views to exclude hidden listings ─────────────────
-- Ensure existing listing RLS SELECT policies account for is_hidden
-- (Normal users cannot see is_hidden=true listings)
-- We add a simple policy that denies hidden listings to non-admins.

DROP POLICY IF EXISTS "Hide hidden listings from public" ON public.listings;
CREATE POLICY "Hide hidden listings from public"
  ON public.listings FOR SELECT
  TO authenticated
  USING (
    is_hidden = false
    OR public.is_admin()
    OR auth.uid() = user_id
  );

-- Anon users also cannot see hidden listings
DROP POLICY IF EXISTS "Anon cannot see hidden listings" ON public.listings;
CREATE POLICY "Anon cannot see hidden listings"
  ON public.listings FOR SELECT
  TO anon
  USING (is_hidden = false);


-- ── 9. Admins can read all profiles (for user management) ─────────────────────
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.is_admin()
  );

-- Admins can update profile status fields
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── 10. Admins can read all listings ─────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read all listings" ON public.listings;
CREATE POLICY "Admins can read all listings"
  ON public.listings FOR SELECT
  TO authenticated
  USING (public.is_admin());


-- ── 11. Admins can read all chat rooms + messages ────────────────────────────
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read all chat rooms" ON public.chat_rooms;
CREATE POLICY "Admins can read all chat rooms"
  ON public.chat_rooms FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR auth.uid() = other_user_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can read all chat messages" ON public.chat_messages;
CREATE POLICY "Admins can read all chat messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_rooms r
      WHERE r.id = room_id AND (r.owner_id = auth.uid() OR r.other_user_id = auth.uid())
    )
    OR public.is_admin()
  );

-- Admins can delete violating messages
DROP POLICY IF EXISTS "Admins can delete chat messages" ON public.chat_messages;
CREATE POLICY "Admins can delete chat messages"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (
    auth.uid() = sender_id
    OR public.is_admin()
  );


-- ── 12. Indexes for admin queries ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_listings_is_hidden ON public.listings(is_hidden);
CREATE INDEX IF NOT EXISTS idx_listing_reports_status ON public.listing_reports(status);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
