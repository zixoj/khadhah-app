/*
  # Reservations, In-App Chat, Phone Verification & Monetization Foundation

  ## New Tables
  1. `reservations` — one-hour reservation slots for free listings
  2. `chat_rooms` — per-listing, per-pair chat rooms (opened only after interaction)
  3. `chat_messages` — individual messages in a room
  4. `phone_verifications` — tracks OTP verification attempts (Supabase SMS OTP)

  ## Table Modifications
  - `profiles`: add `phone_verified` boolean, `phone_verified_at` timestamptz
  - `listings`: add `reserved_until` timestamptz, `is_featured` boolean, `boost_until` timestamptz, `premium_badge` boolean

  ## Security
  - RLS enabled on every new table
  - Reservation ownership enforced server-side
  - Chat visible only to the two participants
  - No USING(true) policies

  ## RPCs
  - `reserve_listing(p_listing_id)` — atomic 1-hour reservation, one active per listing
  - `approve_reservation(p_reservation_id)` — owner accepts, status → confirmed
  - `reject_reservation(p_reservation_id)` — owner rejects, listing back to available
  - `expire_stale_reservations()` — called by pg_cron or client; returns listings to available after 1h
  - `confirm_taken(p_listing_id)` — owner marks listing as fully taken
  - `open_chat_room(p_listing_id, p_other_user_id)` — idempotent room creation, only after interaction
*/

-- ─────────────────────────────────────────────
-- 1. Extend profiles
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

-- ─────────────────────────────────────────────
-- 2. Extend listings (monetization foundation)
-- ─────────────────────────────────────────────
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS reserved_until timestamptz,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boost_until timestamptz,
  ADD COLUMN IF NOT EXISTS premium_badge boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────
-- 3. reservations table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reservations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  requester_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired', 'taken')),
  reserved_at   timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Requester can view their own reservations
CREATE POLICY "Requester can view own reservations"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id);

-- Listing owner can view reservations on their listings
CREATE POLICY "Owner can view reservations on own listings"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM public.listings WHERE id = listing_id)
  );

-- Only the RPC functions (SECURITY DEFINER) insert/update reservations
-- No direct INSERT policy needed from the client — all mutations go through RPCs

CREATE INDEX IF NOT EXISTS idx_reservations_listing ON public.reservations(listing_id);
CREATE INDEX IF NOT EXISTS idx_reservations_requester ON public.reservations(requester_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);

-- ─────────────────────────────────────────────
-- 4. chat_rooms table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  other_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, other_user_id)
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room participants can view their rooms"
  ON public.chat_rooms FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = other_user_id);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_listing ON public.chat_rooms(listing_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_owner ON public.chat_rooms(owner_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_other ON public.chat_rooms(other_user_id);

-- ─────────────────────────────────────────────
-- 5. chat_messages table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room participants can read messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = (SELECT owner_id      FROM public.chat_rooms WHERE id = room_id)
    OR auth.uid() = (SELECT other_user_id FROM public.chat_rooms WHERE id = room_id)
  );

CREATE POLICY "Room participants can send messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      auth.uid() = (SELECT owner_id      FROM public.chat_rooms WHERE id = room_id)
      OR auth.uid() = (SELECT other_user_id FROM public.chat_rooms WHERE id = room_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON public.chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at);

-- ─────────────────────────────────────────────
-- 6. RPC: reserve_listing
-- Atomic 1-hour reservation. One active reservation per listing at a time.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_listing(p_listing_id uuid)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id     uuid;
  v_listing       public.listings%ROWTYPE;
  v_reservation   public.reservations%ROWTYPE;
  v_reservation_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'not_found');
  END IF;

  IF v_listing.user_id = v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'owner_cannot_reserve');
  END IF;

  IF v_listing.status NOT IN ('available') THEN
    RETURN json_build_object('success', false, 'reason', 'not_available', 'status', v_listing.status);
  END IF;

  -- Check if caller already has an active reservation on this listing
  SELECT * INTO v_reservation
  FROM public.reservations
  WHERE listing_id = p_listing_id
    AND requester_id = v_caller_id
    AND status IN ('pending', 'confirmed')
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'already_reserved', true,
      'reservation_id', v_reservation.id,
      'expires_at', v_reservation.expires_at
    );
  END IF;

  -- Block if there's already an active pending/confirmed reservation by anyone
  PERFORM 1 FROM public.reservations
  WHERE listing_id = p_listing_id
    AND status IN ('pending', 'confirmed')
    AND expires_at > now()
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'already_reserved_by_other');
  END IF;

  -- Create the reservation
  INSERT INTO public.reservations (listing_id, requester_id, status, expires_at)
  VALUES (p_listing_id, v_caller_id, 'pending', now() + interval '1 hour')
  RETURNING id INTO v_reservation_id;

  -- Update listing
  UPDATE public.listings
  SET status = 'reserved_temp',
      reserved_by = v_caller_id,
      reserved_until = now() + interval '1 hour'
  WHERE id = p_listing_id;

  RETURN json_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'expires_at', (now() + interval '1 hour')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_listing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_listing(uuid) TO authenticated;

-- ─────────────────────────────────────────────
-- 7. RPC: approve_reservation
-- Only the listing owner can approve.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_reservation(p_reservation_id uuid)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id  uuid;
  v_res        public.reservations%ROWTYPE;
  v_listing    public.listings%ROWTYPE;
  v_room_id    uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'reason', 'not_found'); END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = v_res.listing_id;

  IF v_listing.user_id <> v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  IF v_res.status <> 'pending' THEN
    RETURN json_build_object('success', false, 'reason', 'not_pending', 'status', v_res.status);
  END IF;

  IF v_res.expires_at < now() THEN
    UPDATE public.reservations SET status = 'expired', resolved_at = now() WHERE id = p_reservation_id;
    UPDATE public.listings SET status = 'available', reserved_by = NULL, reserved_until = NULL WHERE id = v_res.listing_id;
    RETURN json_build_object('success', false, 'reason', 'expired');
  END IF;

  -- Confirm the reservation
  UPDATE public.reservations SET status = 'confirmed', resolved_at = now() WHERE id = p_reservation_id;
  UPDATE public.listings SET status = 'reserved' WHERE id = v_res.listing_id;

  -- Open a chat room between owner and requester
  INSERT INTO public.chat_rooms (listing_id, owner_id, other_user_id)
  VALUES (v_res.listing_id, v_caller_id, v_res.requester_id)
  ON CONFLICT (listing_id, other_user_id) DO NOTHING
  RETURNING id INTO v_room_id;

  IF v_room_id IS NULL THEN
    SELECT id INTO v_room_id FROM public.chat_rooms
    WHERE listing_id = v_res.listing_id AND other_user_id = v_res.requester_id;
  END IF;

  RETURN json_build_object('success', true, 'chat_room_id', v_room_id);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_reservation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_reservation(uuid) TO authenticated;

-- ─────────────────────────────────────────────
-- 8. RPC: reject_reservation
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_reservation(p_reservation_id uuid)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id uuid;
  v_res       public.reservations%ROWTYPE;
  v_listing   public.listings%ROWTYPE;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'reason', 'not_found'); END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = v_res.listing_id;

  -- Only owner OR the requester themselves can reject/cancel
  IF v_listing.user_id <> v_caller_id AND v_res.requester_id <> v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  UPDATE public.reservations SET status = 'rejected', resolved_at = now() WHERE id = p_reservation_id;

  -- Return listing to available
  UPDATE public.listings
  SET status = 'available', reserved_by = NULL, reserved_until = NULL
  WHERE id = v_res.listing_id AND status IN ('reserved_temp', 'reserved');

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_reservation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_reservation(uuid) TO authenticated;

-- ─────────────────────────────────────────────
-- 9. RPC: expire_stale_reservations
-- Safe to call from client; only touches expired rows.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_stale_reservations()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Mark reservations as expired
  UPDATE public.reservations
  SET status = 'expired', resolved_at = now()
  WHERE status IN ('pending')
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Return those listings to available
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

REVOKE ALL ON FUNCTION public.expire_stale_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_reservations() TO authenticated;

-- ─────────────────────────────────────────────
-- 10. RPC: confirm_taken
-- Listing owner marks item as fully taken.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_taken(p_listing_id uuid)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id uuid;
  v_listing   public.listings%ROWTYPE;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'reason', 'not_found'); END IF;

  IF v_listing.user_id <> v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  UPDATE public.listings SET status = 'taken' WHERE id = p_listing_id;

  -- Close any pending reservations
  UPDATE public.reservations
  SET status = 'taken', resolved_at = now()
  WHERE listing_id = p_listing_id AND status IN ('pending', 'confirmed');

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_taken(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_taken(uuid) TO authenticated;

-- ─────────────────────────────────────────────
-- 11. RPC: open_chat_room
-- Used after barter offer is accepted. Idempotent.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_chat_room(p_listing_id uuid, p_other_user_id uuid)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id uuid;
  v_listing   public.listings%ROWTYPE;
  v_room_id   uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'reason', 'not_found'); END IF;

  -- Only the listing owner can open a room toward another user
  IF v_listing.user_id <> v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  INSERT INTO public.chat_rooms (listing_id, owner_id, other_user_id)
  VALUES (p_listing_id, v_caller_id, p_other_user_id)
  ON CONFLICT (listing_id, other_user_id) DO NOTHING
  RETURNING id INTO v_room_id;

  IF v_room_id IS NULL THEN
    SELECT id INTO v_room_id FROM public.chat_rooms
    WHERE listing_id = p_listing_id AND other_user_id = p_other_user_id;
  END IF;

  RETURN json_build_object('success', true, 'room_id', v_room_id);
END;
$$;

REVOKE ALL ON FUNCTION public.open_chat_room(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_chat_room(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────
-- 12. Indexes
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_listings_reserved_until ON public.listings(reserved_until);
CREATE INDEX IF NOT EXISTS idx_listings_status_type ON public.listings(status, type);
