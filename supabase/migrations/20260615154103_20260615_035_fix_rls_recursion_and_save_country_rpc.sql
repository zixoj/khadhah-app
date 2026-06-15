-- ============================================================
-- Drop the ambiguous old 6-param overload that has recursive
-- RLS evaluation and replace with a single clean version.
-- Also create a dedicated save_user_country function that uses
-- SECURITY DEFINER to bypass the recursive RLS check.
-- ============================================================

-- 1. Drop the old 6-parameter overload (causes stack depth exceeded via
--    self-referential RLS subquery on profiles during UPDATE)
DROP FUNCTION IF EXISTS public.update_profile_fields(text, text, text, text, text, text);

-- 2. Dedicated country/phone save function — SECURITY DEFINER bypasses
--    the profiles RLS recursion for this targeted, auth-gated update.
CREATE OR REPLACE FUNCTION public.save_user_country(
  p_country           text,
  p_country_code      text,
  p_phone_number      text,
  p_full_phone_number text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_country IS NULL OR trim(p_country) = '' THEN
    RETURN json_build_object('success', false, 'reason', 'country_required');
  END IF;

  IF p_phone_number IS NULL OR trim(p_phone_number) = '' THEN
    RETURN json_build_object('success', false, 'reason', 'phone_required');
  END IF;

  -- Phone uniqueness check (by full phone number)
  IF p_full_phone_number IS NOT NULL AND trim(p_full_phone_number) <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE (phone = trim(p_full_phone_number) OR full_phone_number = trim(p_full_phone_number))
        AND id <> v_caller_id
    ) THEN
      RETURN json_build_object('success', false, 'reason', 'phone_taken');
    END IF;
  END IF;

  UPDATE public.profiles SET
    country           = trim(p_country),
    country_code      = trim(p_country_code),
    phone_number      = trim(p_phone_number),
    full_phone_number = NULLIF(trim(p_full_phone_number), ''),
    phone             = COALESCE(NULLIF(trim(p_full_phone_number), ''), phone)
  WHERE id = v_caller_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.save_user_country(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_user_country(text, text, text, text) TO authenticated;

-- 3. Also update the 11-param update_profile_fields to use SECURITY DEFINER
--    so it too avoids the recursive RLS problem.
CREATE OR REPLACE FUNCTION public.update_profile_fields(
  p_display_name      text DEFAULT NULL,
  p_username          text DEFAULT NULL,
  p_full_name         text DEFAULT NULL,
  p_phone             text DEFAULT NULL,
  p_city              text DEFAULT NULL,
  p_role              text DEFAULT NULL,
  p_avatar_url        text DEFAULT NULL,
  p_country           text DEFAULT NULL,
  p_country_code      text DEFAULT NULL,
  p_phone_number      text DEFAULT NULL,
  p_full_phone_number text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id      uuid;
  v_profile        public.profiles%ROWTYPE;
  v_days_since     numeric;
  v_remaining      integer;
  v_clean_username text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_caller_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  -- Block admin self-modification via this RPC
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

  -- username cooldown (30 days) + uniqueness
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
  IF p_phone IS NOT NULL AND trim(p_phone) <> '' AND trim(p_phone) <> COALESCE(v_profile.phone, '') THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE phone = trim(p_phone) AND id <> v_caller_id) THEN
      RETURN json_build_object('success', false, 'reason', 'phone_taken');
    END IF;
  END IF;

  UPDATE public.profiles SET
    full_name    = COALESCE(p_full_name, full_name),
    display_name = CASE
      WHEN p_display_name IS NOT NULL AND trim(p_display_name) <> COALESCE(display_name,'')
        THEN trim(p_display_name) ELSE display_name END,
    last_display_name_change_at = CASE
      WHEN p_display_name IS NOT NULL AND trim(p_display_name) <> COALESCE(display_name,'')
        THEN now() ELSE last_display_name_change_at END,
    username = CASE
      WHEN p_username IS NOT NULL AND trim(p_username) <> COALESCE(username,'')
        THEN lower(trim(p_username)) ELSE username END,
    last_username_change_at = CASE
      WHEN p_username IS NOT NULL AND trim(p_username) <> COALESCE(username,'')
        THEN now() ELSE last_username_change_at END,
    phone             = COALESCE(NULLIF(trim(p_phone),''),             phone),
    city              = COALESCE(NULLIF(trim(p_city),''),              city),
    avatar_url        = COALESCE(p_avatar_url,                         avatar_url),
    country           = COALESCE(NULLIF(trim(p_country),''),           country),
    country_code      = COALESCE(NULLIF(trim(p_country_code),''),      country_code),
    phone_number      = COALESCE(NULLIF(trim(p_phone_number),''),      phone_number),
    full_phone_number = COALESCE(NULLIF(trim(p_full_phone_number),''), full_phone_number)
  WHERE id = v_caller_id;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile_fields(text,text,text,text,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_profile_fields(text,text,text,text,text,text,text,text,text,text,text) TO authenticated;
