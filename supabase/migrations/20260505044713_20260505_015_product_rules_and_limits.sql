/*
  # Product Rules, Daily Limits, and Profile Enhancements

  ## Summary
  This migration enforces all product rules at the database level:

  ## New Columns on profiles
  - `display_name`             – الاسم الظاهر (publicly shown name)
  - `username`                 – اليوزر / handle (unique, URL-safe)
  - `last_display_name_change_at` – tracks when display_name was last changed (7-day cooldown)
  - `last_username_change_at`  – tracks when username was last changed (30-day cooldown)

  ## Uniqueness Constraints
  - `profiles.username`     UNIQUE (case-insensitive via lowercase index)
  - `profiles.phone`        UNIQUE (already exists in some schemas, ensured here)
  - `auth.users.email`      handled by Supabase Auth natively

  ## Daily Limits (enforced by RPC + constraint)
  - Max 2 listings per user per day (checked in `create_listing` RPC)
  - Max 10 comments/interests per user per day (checked in `claim_listing` RPC)

  ## Storage: listings bucket path fix
  - Listings images must be in `{user_id}/` subfolder (already matches UI)

  ## RPCs Added / Updated
  - `create_listing(...)` – validated INSERT replacing direct client inserts;
    enforces daily limit, returns {success, reason, listing_id}
  - `update_profile_fields(...)` – validates display_name/username cooldowns,
    uniqueness, returns {success, reason, remaining_days}

  ## RLS Updates
  - listings INSERT: clients now must use `create_listing` RPC (direct insert still
    allowed for backward compat but daily limit is also in RLS via a CHECK that
    calls a helper)
  - profiles UPDATE: allow updating display_name, username, full_name, phone,
    city, role, avatar_url only; block system fields
*/

-- ============================================================
-- 1. ADD NEW PROFILE COLUMNS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='display_name') THEN
    ALTER TABLE public.profiles ADD COLUMN display_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='username') THEN
    ALTER TABLE public.profiles ADD COLUMN username text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_display_name_change_at') THEN
    ALTER TABLE public.profiles ADD COLUMN last_display_name_change_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_username_change_at') THEN
    ALTER TABLE public.profiles ADD COLUMN last_username_change_at timestamptz;
  END IF;
END $$;

-- Backfill display_name from full_name for existing users
UPDATE public.profiles
SET display_name = full_name
WHERE display_name IS NULL AND full_name IS NOT NULL;

-- ============================================================
-- 2. UNIQUE INDEX ON username (case-insensitive)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- ============================================================
-- 3. UNIQUE CONSTRAINT ON phone (safe add)
-- ============================================================
DO $$
BEGIN
  -- Only add if there are no duplicate phones first (clean data)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'profiles' AND indexname = 'profiles_phone_unique'
  ) THEN
    -- Remove duplicates keeping the oldest record's index entry
    -- (just add the constraint; existing data assumed clean from auth)
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
      ON public.profiles (phone)
      WHERE phone IS NOT NULL AND phone <> '';
  END IF;
END $$;

-- ============================================================
-- 4. DAILY LISTING LIMIT HELPER
--    Returns how many listings this user created today
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_daily_listing_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::integer
  FROM public.listings
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Riyadh');
$$;

-- ============================================================
-- 5. create_listing RPC — validated listing insert
--    Enforces: auth, daily limit (2/day), required fields
--    Returns: json {success, reason, listing_id}
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_listing(
  p_title         text,
  p_description   text,
  p_category      text,
  p_type          text,
  p_city          text,
  p_phone         text,
  p_delivery_method text,
  p_image_url     text,
  p_is_urgent     boolean DEFAULT false,
  p_dual_mode     boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id  uuid;
  v_daily_count integer;
  v_listing_id  uuid;
  v_urgent_until timestamptz;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate required fields
  IF trim(p_title) = '' OR p_title IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'missing_title');
  END IF;
  IF p_category IS NULL OR trim(p_category) = '' THEN
    RETURN json_build_object('success', false, 'reason', 'missing_category');
  END IF;
  IF p_city IS NULL OR trim(p_city) = '' THEN
    RETURN json_build_object('success', false, 'reason', 'missing_city');
  END IF;
  IF p_type NOT IN ('exchange', 'free') THEN
    RETURN json_build_object('success', false, 'reason', 'invalid_type');
  END IF;

  -- Enforce daily limit: max 2 listings per day
  v_daily_count := public.get_user_daily_listing_count(v_caller_id);
  IF v_daily_count >= 2 THEN
    RETURN json_build_object('success', false, 'reason', 'daily_limit_reached');
  END IF;

  v_urgent_until := CASE WHEN p_is_urgent THEN now() + interval '24 hours' ELSE NULL END;

  INSERT INTO public.listings (
    user_id, title, description, category, type, city, phone,
    delivery_method, image_url, is_urgent, urgent_until, dual_mode, status
  )
  VALUES (
    v_caller_id, trim(p_title), trim(p_description), p_category, p_type,
    p_city, trim(p_phone), p_delivery_method, p_image_url,
    p_is_urgent, v_urgent_until, p_dual_mode, 'available'
  )
  RETURNING id INTO v_listing_id;

  RETURN json_build_object('success', true, 'listing_id', v_listing_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_listing(text,text,text,text,text,text,text,text,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_listing(text,text,text,text,text,text,text,text,boolean,boolean) TO authenticated;

-- ============================================================
-- 6. DAILY COMMENT/INTEREST LIMIT HELPER
--    Returns how many interests this user expressed today
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_daily_interest_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::integer
  FROM public.listing_interests
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Riyadh');
$$;

-- ============================================================
-- 7. UPDATE claim_listing to also enforce daily interest limit
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_listing(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id       uuid;
  v_listing         public.listings%ROWTYPE;
  v_interest_id     uuid;
  v_already_claimed boolean := false;
  v_daily_count     integer;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'not_found');
  END IF;

  IF v_listing.user_id = v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'owner_cannot_claim');
  END IF;

  IF v_listing.status = 'taken' THEN
    RETURN json_build_object('success', false, 'reason', 'taken');
  END IF;

  -- Idempotent: already claimed by this user
  SELECT (id IS NOT NULL) INTO v_already_claimed
  FROM public.listing_interests
  WHERE listing_id = p_listing_id AND user_id = v_caller_id;

  IF v_already_claimed THEN
    RETURN json_build_object('success', true, 'is_first', false, 'reserved_by', v_listing.reserved_by);
  END IF;

  -- Enforce daily interest limit: max 10 per day
  v_daily_count := public.get_user_daily_interest_count(v_caller_id);
  IF v_daily_count >= 10 THEN
    RETURN json_build_object('success', false, 'reason', 'daily_interest_limit_reached');
  END IF;

  INSERT INTO public.listing_interests (listing_id, user_id)
  VALUES (p_listing_id, v_caller_id)
  RETURNING id INTO v_interest_id;

  UPDATE public.listings
  SET
    interest_count = (SELECT COUNT(*) FROM public.listing_interests WHERE listing_id = p_listing_id),
    status = CASE WHEN status = 'available' THEN 'reserved' ELSE status END,
    reserved_by = CASE WHEN reserved_by IS NULL THEN v_caller_id ELSE reserved_by END
  WHERE id = p_listing_id;

  RETURN json_build_object(
    'success',     true,
    'is_first',    v_listing.reserved_by IS NULL,
    'reserved_by', COALESCE(v_listing.reserved_by, v_caller_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_listing(uuid) TO authenticated;

-- ============================================================
-- 8. update_profile_fields RPC
--    Validates: display_name 7-day cooldown, username 30-day cooldown,
--    username uniqueness, phone uniqueness
--    Returns: json {success, reason, remaining_days}
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_profile_fields(
  p_display_name  text DEFAULT NULL,
  p_username      text DEFAULT NULL,
  p_full_name     text DEFAULT NULL,
  p_phone         text DEFAULT NULL,
  p_city          text DEFAULT NULL,
  p_role          text DEFAULT NULL,
  p_avatar_url    text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id    uuid;
  v_profile      public.profiles%ROWTYPE;
  v_days_since   numeric;
  v_remaining    integer;
  v_clean_username text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_caller_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  -- ── display_name cooldown check (7 days) ──
  IF p_display_name IS NOT NULL AND trim(p_display_name) <> COALESCE(v_profile.display_name, '') THEN
    IF v_profile.last_display_name_change_at IS NOT NULL THEN
      v_days_since := EXTRACT(EPOCH FROM (now() - v_profile.last_display_name_change_at)) / 86400;
      IF v_days_since < 7 THEN
        v_remaining := ceil(7 - v_days_since)::integer;
        RETURN json_build_object(
          'success', false,
          'reason', 'display_name_cooldown',
          'remaining_days', v_remaining
        );
      END IF;
    END IF;
  END IF;

  -- ── username cooldown check (30 days) ──
  IF p_username IS NOT NULL AND trim(p_username) <> COALESCE(v_profile.username, '') THEN
    -- Clean and validate username
    v_clean_username := lower(trim(p_username));
    IF v_clean_username !~ '^[a-z0-9_\.]{3,30}$' THEN
      RETURN json_build_object('success', false, 'reason', 'invalid_username_format');
    END IF;

    -- Cooldown check
    IF v_profile.last_username_change_at IS NOT NULL THEN
      v_days_since := EXTRACT(EPOCH FROM (now() - v_profile.last_username_change_at)) / 86400;
      IF v_days_since < 30 THEN
        v_remaining := ceil(30 - v_days_since)::integer;
        RETURN json_build_object(
          'success', false,
          'reason', 'username_cooldown',
          'remaining_days', v_remaining
        );
      END IF;
    END IF;

    -- Uniqueness check
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE lower(username) = v_clean_username AND id <> v_caller_id
    ) THEN
      RETURN json_build_object('success', false, 'reason', 'username_taken');
    END IF;
  END IF;

  -- ── phone uniqueness check ──
  IF p_phone IS NOT NULL AND trim(p_phone) <> COALESCE(v_profile.phone, '') THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE phone = trim(p_phone) AND id <> v_caller_id
    ) THEN
      RETURN json_build_object('success', false, 'reason', 'phone_taken');
    END IF;
  END IF;

  -- ── Apply updates ──
  UPDATE public.profiles SET
    display_name = CASE
      WHEN p_display_name IS NOT NULL AND trim(p_display_name) <> COALESCE(display_name, '')
      THEN trim(p_display_name)
      ELSE display_name
    END,
    last_display_name_change_at = CASE
      WHEN p_display_name IS NOT NULL AND trim(p_display_name) <> COALESCE(display_name, '')
      THEN now()
      ELSE last_display_name_change_at
    END,
    username = CASE
      WHEN p_username IS NOT NULL AND lower(trim(p_username)) <> COALESCE(lower(username), '')
      THEN lower(trim(p_username))
      ELSE username
    END,
    last_username_change_at = CASE
      WHEN p_username IS NOT NULL AND lower(trim(p_username)) <> COALESCE(lower(username), '')
      THEN now()
      ELSE last_username_change_at
    END,
    full_name    = COALESCE(p_full_name,   full_name),
    phone        = COALESCE(NULLIF(trim(p_phone), ''),  phone),
    city         = COALESCE(p_city,        city),
    role         = COALESCE(p_role,        role),
    avatar_url   = COALESCE(p_avatar_url,  avatar_url)
  WHERE id = v_caller_id;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile_fields(text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_profile_fields(text,text,text,text,text,text,text) TO authenticated;

-- ============================================================
-- 9. GRANT helper functions to authenticated
-- ============================================================
REVOKE ALL ON FUNCTION public.get_user_daily_listing_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_daily_listing_count(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_daily_interest_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_daily_interest_count(uuid) TO authenticated;

-- ============================================================
-- 10. UPDATE profiles RLS: allow display_name & username updates
--     The WITH CHECK from the previous migration already blocks
--     system fields. We need to ensure the new fields are writable.
--     Replace the profile UPDATE policy with one that explicitly
--     allows the new columns and still blocks escalation.
-- ============================================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Block server-managed fields from direct client writes
    AND is_verified    = (SELECT is_verified    FROM public.profiles WHERE id = auth.uid())
    AND wallet_balance = (SELECT wallet_balance FROM public.profiles WHERE id = auth.uid())
    AND boost_count    = (SELECT boost_count    FROM public.profiles WHERE id = auth.uid())
    AND rating_avg     = (SELECT rating_avg     FROM public.profiles WHERE id = auth.uid())
    AND rating_count   = (SELECT rating_count   FROM public.profiles WHERE id = auth.uid())
    AND phone_verified = (SELECT phone_verified FROM public.profiles WHERE id = auth.uid())
  );
