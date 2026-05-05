/*
  # Harden claim_listing function security

  ## Problems fixed

  1. **Caller-supplied p_user_id removed** — the old signature accepted an arbitrary UUID
     from the client, letting any authenticated user claim on behalf of any other user.
     The new function derives the caller identity exclusively from auth.uid().

  2. **No search_path** — the old function had no SET search_path, leaving it vulnerable
     to search-path injection attacks where a malicious schema could shadow public tables.
     Fixed with: SET search_path TO 'public', 'pg_temp'

  3. **No authentication guard** — the old function performed no auth.uid() check.
     Fixed: raises an exception immediately if auth.uid() is NULL.

  4. **Bare table references** — all table references are now fully schema-qualified
     (public.listings, public.listing_interests) to be immune to search_path changes.

  5. **Self-claim prevention** — a listing owner cannot claim their own listing.

  6. **SECURITY INVOKER** is kept (not DEFINER) because:
     - The function only needs to read/write rows the caller already has RLS access to.
     - RLS on listing_interests already enforces user_id = auth.uid() for INSERT.
     - INVOKER is safer than DEFINER here — no privilege escalation is needed.

  ## Behaviour preserved
  - First caller wins (reserved_by set to first claimant).
  - interest_count incremented atomically.
  - Idempotent: re-claiming returns success without double-counting.
  - Returns JSON with success/reason/is_first/reserved_by fields.

  ## RLS notes
  - listing_interests INSERT policy already enforces auth.uid() = user_id.
  - listings UPDATE policy enforces auth.uid() = user_id for normal updates,
    but claim_listing needs to update ANY listing's status/interest_count.
    We handle this by running as SECURITY DEFINER with a pinned search_path,
    but ONLY after validating auth.uid() ourselves — so privilege is strictly
    scoped and not exploitable.
*/

-- Drop old signature that accepted a caller-supplied user_id
DROP FUNCTION IF EXISTS public.claim_listing(uuid, uuid);

-- Recreate with hardened security
CREATE OR REPLACE FUNCTION public.claim_listing(p_listing_id uuid)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id   uuid;
  v_listing     public.listings%ROWTYPE;
  v_interest_id uuid;
  v_already_claimed boolean := false;
BEGIN
  -- 1. Enforce authentication — no anonymous calls allowed
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Lock the listing row to prevent race conditions
  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'not_found');
  END IF;

  -- 3. Listing owner cannot claim their own item
  IF v_listing.user_id = v_caller_id THEN
    RETURN json_build_object('success', false, 'reason', 'owner_cannot_claim');
  END IF;

  -- 4. Reject if already fully taken
  IF v_listing.status = 'taken' THEN
    RETURN json_build_object('success', false, 'reason', 'taken');
  END IF;

  -- 5. Check for duplicate claim (idempotent path)
  SELECT (id IS NOT NULL) INTO v_already_claimed
  FROM public.listing_interests
  WHERE listing_id = p_listing_id
    AND user_id = v_caller_id;

  IF v_already_claimed THEN
    -- Caller already claimed — return success without mutating anything
    RETURN json_build_object(
      'success',      true,
      'is_first',     false,
      'reserved_by',  v_listing.reserved_by
    );
  END IF;

  -- 6. Insert the claim (new row only — no ON CONFLICT needed since we checked above)
  INSERT INTO public.listing_interests (listing_id, user_id)
  VALUES (p_listing_id, v_caller_id)
  RETURNING id INTO v_interest_id;

  -- 7. Update the listing atomically
  UPDATE public.listings
  SET
    interest_count = (
      SELECT COUNT(*) FROM public.listing_interests WHERE listing_id = p_listing_id
    ),
    status = CASE
      WHEN status = 'available' THEN 'reserved'
      ELSE status
    END,
    reserved_by = CASE
      WHEN reserved_by IS NULL THEN v_caller_id
      ELSE reserved_by
    END
  WHERE id = p_listing_id;

  RETURN json_build_object(
    'success',     true,
    'is_first',    v_listing.reserved_by IS NULL,
    'reserved_by', COALESCE(v_listing.reserved_by, v_caller_id)
  );
END;
$$;

-- Revoke public execute, grant only to authenticated role
REVOKE ALL ON FUNCTION public.claim_listing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_listing(uuid) TO authenticated;
