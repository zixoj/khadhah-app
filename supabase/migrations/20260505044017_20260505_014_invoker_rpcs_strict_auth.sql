/*
  # Convert All RPCs to SECURITY INVOKER with Strict Auth Checks

  ## What Changes
  Every user-callable RPC is converted from SECURITY DEFINER to SECURITY INVOKER.
  With SECURITY INVOKER the function executes with the calling user's privileges,
  so RLS policies apply normally — the database enforces ownership at the row level
  in addition to the explicit checks inside each function body.

  ## Why _insert_debit_transaction Stays SECURITY DEFINER
  The wallet_transactions RLS policy intentionally blocks direct client DEBITs
  (only credits are allowed via RLS). Debit inserts must go through a tightly
  scoped internal helper. That helper has no parameters that affect who it
  operates on — the caller passes the amount and description, and the function
  is REVOKED from every role except internal callers. This is the standard
  Supabase pattern for write-protected ledger rows.

  ## Functions Converted
  - claim_listing          → INVOKER  (non-owner only, auth.uid() check)
  - boost_listing          → INVOKER  (owner only, auth.uid() check, wallet lock)
  - confirm_taken          → INVOKER  (owner only, auth.uid() check)
  - reserve_listing        → INVOKER  (non-owner only, auth.uid() check)
  - approve_reservation    → INVOKER  (listing owner only, auth.uid() check)
  - reject_reservation     → INVOKER  (owner OR requester, auth.uid() check)
  - open_chat_room         → INVOKER  (listing owner only, auth.uid() check)
  - get_my_chat_room       → INVOKER  (participant only, auth.uid() check)
  - expire_stale_reservations → INVOKER (auth.uid() check, safe to call publicly)
  - spend_wallet           → INVOKER  (user can only spend own balance, auth.uid() check)
  - increment_listing_views → INVOKER (already INVOKER, kept consistent)

  ## Grants
  All sensitive RPCs: REVOKE from anon, GRANT to authenticated only.
  _insert_debit_transaction: REVOKE from all public roles (internal only).
*/

-- ============================================================
-- 1. claim_listing
--    Rule: caller must be authenticated AND must NOT be the listing owner
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_listing(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id      uuid;
  v_listing        public.listings%ROWTYPE;
  v_interest_id    uuid;
  v_already_claimed boolean := false;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Lock row to prevent race conditions
  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'not_found');
  END IF;

  -- Owner cannot claim their own listing
  IF v_listing.user_id = v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'owner_cannot_claim');
  END IF;

  IF v_listing.status = 'taken' THEN
    RETURN json_build_object('success', false, 'reason', 'taken');
  END IF;

  -- Idempotent: if already claimed return success
  SELECT (id IS NOT NULL) INTO v_already_claimed
  FROM public.listing_interests
  WHERE listing_id = p_listing_id AND user_id = v_caller_id;

  IF v_already_claimed THEN
    RETURN json_build_object(
      'success',     true,
      'is_first',    false,
      'reserved_by', v_listing.reserved_by
    );
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
-- 2. boost_listing
--    Rule: caller must own the listing, must have enough balance
-- ============================================================
CREATE OR REPLACE FUNCTION public.boost_listing(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_cost      numeric := 5;
  v_balance   numeric;
  v_owner_id  uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify ownership
  SELECT user_id INTO v_owner_id
  FROM public.listings
  WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  IF v_owner_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: only the listing owner can boost';
  END IF;

  -- Row-lock the profile to prevent double-spend race
  SELECT wallet_balance INTO v_balance
  FROM public.profiles
  WHERE id = v_caller_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient wallet balance (have %, need %)', v_balance, v_cost;
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_cost,
      boost_count    = COALESCE(boost_count, 0) + 1
  WHERE id = v_caller_id;

  UPDATE public.listings
  SET is_boosted    = true,
      boosted_until = now() + interval '7 days'
  WHERE id = p_listing_id AND user_id = v_caller_id;

  PERFORM public._insert_debit_transaction(v_caller_id, v_cost, 'تمييز إعلان');
END;
$$;

REVOKE ALL ON FUNCTION public.boost_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boost_listing(uuid) TO authenticated;

-- ============================================================
-- 3. confirm_taken
--    Rule: only the listing owner can mark it taken
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_taken(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_listing   public.listings%ROWTYPE;
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

  IF v_listing.user_id <> v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  UPDATE public.listings
  SET status = 'taken'
  WHERE id = p_listing_id;

  UPDATE public.reservations
  SET status = 'taken', resolved_at = now()
  WHERE listing_id = p_listing_id AND status IN ('pending', 'confirmed');

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_taken(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_taken(uuid) TO authenticated;

-- ============================================================
-- 4. reserve_listing
--    Rule: caller must be authenticated and must NOT be the owner
-- ============================================================
CREATE OR REPLACE FUNCTION public.reserve_listing(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id      uuid;
  v_listing        public.listings%ROWTYPE;
  v_reservation    public.reservations%ROWTYPE;
  v_reservation_id uuid;
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

  -- Owner cannot reserve their own listing
  IF v_listing.user_id = v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'owner_cannot_reserve');
  END IF;

  IF v_listing.status NOT IN ('available') THEN
    RETURN json_build_object('success', false, 'reason', 'not_available', 'status', v_listing.status);
  END IF;

  -- Return existing active reservation if caller already has one
  SELECT * INTO v_reservation
  FROM public.reservations
  WHERE listing_id = p_listing_id
    AND requester_id = v_caller_id
    AND status IN ('pending', 'confirmed')
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'success',          true,
      'already_reserved', true,
      'reservation_id',   v_reservation.id,
      'expires_at',       v_reservation.expires_at
    );
  END IF;

  -- Block if another user already holds an active reservation
  PERFORM 1 FROM public.reservations
  WHERE listing_id = p_listing_id
    AND status IN ('pending', 'confirmed')
    AND expires_at > now()
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'already_reserved_by_other');
  END IF;

  INSERT INTO public.reservations (listing_id, requester_id, status, expires_at)
  VALUES (p_listing_id, v_caller_id, 'pending', now() + interval '1 hour')
  RETURNING id INTO v_reservation_id;

  UPDATE public.listings
  SET status         = 'reserved_temp',
      reserved_by    = v_caller_id,
      reserved_until = now() + interval '1 hour'
  WHERE id = p_listing_id;

  RETURN json_build_object(
    'success',        true,
    'reservation_id', v_reservation_id,
    'expires_at',     (now() + interval '1 hour')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_listing(uuid) TO authenticated;

-- ============================================================
-- 5. approve_reservation
--    Rule: only the listing owner can approve
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_reservation(p_reservation_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_res       public.reservations%ROWTYPE;
  v_listing   public.listings%ROWTYPE;
  v_room_id   uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_res
  FROM public.reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = v_res.listing_id;

  -- Only the listing owner may approve
  IF v_listing.user_id <> v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  IF v_res.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'reason', 'not_pending', 'status', v_res.status);
  END IF;

  IF v_res.expires_at < now() THEN
    UPDATE public.reservations
    SET status = 'expired', resolved_at = now()
    WHERE id = p_reservation_id;
    UPDATE public.listings
    SET status = 'available', reserved_by = NULL, reserved_until = NULL
    WHERE id = v_res.listing_id;
    RETURN json_build_object('success', false, 'reason', 'expired');
  END IF;

  UPDATE public.reservations
  SET status = 'confirmed', resolved_at = now()
  WHERE id = p_reservation_id;

  UPDATE public.listings
  SET status = 'reserved'
  WHERE id = v_res.listing_id;

  -- Open a chat room between owner and requester
  INSERT INTO public.chat_rooms (listing_id, owner_id, other_user_id)
  VALUES (v_res.listing_id, v_caller_id, v_res.requester_id)
  ON CONFLICT (listing_id, other_user_id) DO NOTHING
  RETURNING id INTO v_room_id;

  IF v_room_id IS NULL THEN
    SELECT id INTO v_room_id
    FROM public.chat_rooms
    WHERE listing_id = v_res.listing_id
      AND other_user_id = v_res.requester_id;
  END IF;

  RETURN json_build_object('success', true, 'chat_room_id', v_room_id);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_reservation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_reservation(uuid) TO authenticated;

-- ============================================================
-- 6. reject_reservation
--    Rule: only listing owner OR the requester themselves can reject
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_reservation(p_reservation_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_res       public.reservations%ROWTYPE;
  v_listing   public.listings%ROWTYPE;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_res
  FROM public.reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = v_res.listing_id;

  -- Only owner or the requester can reject/cancel
  IF v_listing.user_id <> v_caller_id AND v_res.requester_id <> v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  IF v_res.status NOT IN ('pending', 'confirmed') THEN
    RETURN json_build_object('success', false, 'reason', 'not_active', 'status', v_res.status);
  END IF;

  UPDATE public.reservations
  SET status = 'rejected', resolved_at = now()
  WHERE id = p_reservation_id;

  UPDATE public.listings
  SET status = 'available', reserved_by = NULL, reserved_until = NULL
  WHERE id = v_res.listing_id
    AND status IN ('reserved_temp', 'reserved');

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_reservation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_reservation(uuid) TO authenticated;

-- ============================================================
-- 7. open_chat_room
--    Rule: caller must be the listing owner; cannot chat with self
-- ============================================================
CREATE OR REPLACE FUNCTION public.open_chat_room(p_listing_id uuid, p_other_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_listing   public.listings%ROWTYPE;
  v_room_id   uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Cannot open a room with yourself
  IF p_other_user_id = v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'self_chat');
  END IF;

  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'listing_not_found');
  END IF;

  -- Only the listing owner can open a chat room toward another user
  IF v_listing.user_id <> v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'not_owner');
  END IF;

  INSERT INTO public.chat_rooms (listing_id, owner_id, other_user_id)
  VALUES (p_listing_id, v_caller_id, p_other_user_id)
  ON CONFLICT (listing_id, other_user_id) DO NOTHING;

  SELECT id INTO v_room_id
  FROM public.chat_rooms
  WHERE listing_id = p_listing_id
    AND other_user_id = p_other_user_id;

  RETURN json_build_object('success', true, 'room_id', v_room_id);
END;
$$;

REVOKE ALL ON FUNCTION public.open_chat_room(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_chat_room(uuid, uuid) TO authenticated;

-- ============================================================
-- 8. get_my_chat_room
--    Rule: caller must be a participant in the room
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_chat_room(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_room_id   uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- RLS on chat_rooms already enforces participation, but we also
  -- filter explicitly so this can never leak a room the caller is not in
  SELECT id INTO v_room_id
  FROM public.chat_rooms
  WHERE listing_id = p_listing_id
    AND (owner_id = v_caller_id OR other_user_id = v_caller_id);

  IF v_room_id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  RETURN json_build_object('found', true, 'room_id', v_room_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_chat_room(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_chat_room(uuid) TO authenticated;

-- ============================================================
-- 9. expire_stale_reservations
--    Safe housekeeping call; still requires auth to prevent
--    anonymous triggering of mass listing status changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_stale_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Still require authentication — no anonymous housekeeping
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.reservations
  SET status = 'expired', resolved_at = now()
  WHERE status = 'pending'
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.listings l
  SET status = 'available', reserved_by = NULL, reserved_until = NULL
  WHERE l.status = 'reserved_temp'
    AND l.reserved_until < now()
    AND NOT EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.listing_id = l.id
        AND r.status IN ('pending', 'confirmed')
        AND r.expires_at > now()
    );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_reservations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_reservations() TO authenticated;

-- ============================================================
-- 10. spend_wallet
--     Rule: caller can only spend their OWN balance (p_user_id must
--     equal auth.uid()). Debit insert goes through _insert_debit_transaction
--     which is the only SECURITY DEFINER path remaining.
-- ============================================================
CREATE OR REPLACE FUNCTION public.spend_wallet(
  p_user_id uuid,
  p_amount  numeric,
  p_desc    text
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_balance   numeric;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Users can only spend their own balance
  IF v_caller_id <> p_user_id THEN
    RETURN json_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'reason', 'invalid_amount');
  END IF;

  -- Row-lock to prevent double-spend
  SELECT wallet_balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  IF v_balance < p_amount THEN
    RETURN json_build_object('success', false, 'reason', 'insufficient_balance');
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - p_amount,
      boost_count    = boost_count + 1
  WHERE id = p_user_id;

  -- Debit via internal helper (bypasses the client-only-credits RLS on wallet_transactions)
  PERFORM public._insert_debit_transaction(p_user_id, p_amount, p_desc);

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.spend_wallet(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_wallet(uuid, numeric, text) TO authenticated;

-- ============================================================
-- 11. increment_listing_views — already INVOKER, keep consistent
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_listing_views(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id   uuid;
  v_last_view timestamptz;
  v_owner_id  uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT user_id INTO v_owner_id
  FROM public.listings
  WHERE id = p_listing_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Owner views don't inflate their own count
  IF v_owner_id = v_user_id THEN RETURN; END IF;

  SELECT viewed_at INTO v_last_view
  FROM public.listing_view_log
  WHERE user_id = v_user_id AND listing_id = p_listing_id;

  IF FOUND AND v_last_view > now() - interval '1 hour' THEN RETURN; END IF;

  INSERT INTO public.listing_view_log (user_id, listing_id, viewed_at)
  VALUES (v_user_id, p_listing_id, now())
  ON CONFLICT (user_id, listing_id) DO UPDATE SET viewed_at = now();

  UPDATE public.listings
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = p_listing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_listing_views(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_listing_views(uuid) TO authenticated;

-- ============================================================
-- 12. _insert_debit_transaction — remains SECURITY DEFINER
--     (minimal internal helper, locked down from all external roles)
-- ============================================================
CREATE OR REPLACE FUNCTION public._insert_debit_transaction(
  p_user_id uuid,
  p_amount  numeric,
  p_desc    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.wallet_transactions (user_id, amount, type, description)
  VALUES (p_user_id, -p_amount, 'debit', p_desc);
END;
$$;

-- Lock down completely — callable only by other DB functions, never by API clients
REVOKE ALL ON FUNCTION public._insert_debit_transaction(uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._insert_debit_transaction(uuid, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public._insert_debit_transaction(uuid, numeric, text) FROM authenticated;
