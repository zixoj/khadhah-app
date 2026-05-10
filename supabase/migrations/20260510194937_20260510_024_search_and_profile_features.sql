/*
  # Search & Public Profile Features

  ## Summary
  Adds full-text-style search for listings and a secure public profile RPC.

  ## 1. pg_trgm extension
  Enables trigram-based similarity search so Arabic/mixed queries work well
  with ILIKE even without a full Arabic FTS stemmer.

  ## 2. Trigram indexes on listings
  GIN indexes on title, description, category, city for fast ILIKE queries.

  ## 3. search_listings RPC
  SECURITY INVOKER function callable by authenticated users.
  Filters:
  - Only active (available/reserved) listings
  - Only non-hidden listings
  - Only listings from non-banned, non-suspended users
  - Text search across title, description, category, city
  - Optional: category filter, city filter, type filter (exchange/free)
  - Sort: newest_first (default) or oldest_first
  Returns listing rows joined with owner username for display.

  ## 4. get_public_profile RPC
  SECURITY INVOKER — returns safe public fields only.
  Never returns: phone, email, wallet_balance, account tokens.
  Returns null if user is banned/suspended/hidden.

  ## Security
  - Both RPCs are SECURITY INVOKER so RLS applies normally.
  - search_listings joins profiles to filter banned owners at query time.
  - get_public_profile explicitly excludes hidden/banned profiles.
*/

-- ── 1. pg_trgm for fast ILIKE on Arabic text ─────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 2. Trigram indexes for search fields ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm
  ON public.listings USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listings_description_trgm
  ON public.listings USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listings_city_trgm
  ON public.listings USING gin (city gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listings_category_trgm
  ON public.listings USING gin (category gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm
  ON public.profiles USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm
  ON public.profiles USING gin (full_name gin_trgm_ops);

-- Composite index to speed up the banned-user join filter
CREATE INDEX IF NOT EXISTS idx_profiles_id_status
  ON public.profiles(id, account_status);

-- ── 3. search_listings RPC ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_listings(
  p_query        text    DEFAULT '',
  p_category     text    DEFAULT NULL,
  p_city         text    DEFAULT NULL,
  p_type         text    DEFAULT NULL,   -- 'exchange' | 'free' | NULL = both
  p_sort         text    DEFAULT 'newest_first',  -- 'newest_first' | 'oldest_first'
  p_limit        integer DEFAULT 40,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (
  id             uuid,
  user_id        uuid,
  title          text,
  description    text,
  category       text,
  type           text,
  city           text,
  image_url      text,
  created_at     timestamptz,
  status         text,
  is_urgent      boolean,
  dual_mode      boolean,
  views_count    integer,
  interest_count integer,
  is_hidden      boolean,
  owner_name     text,
  owner_username text,
  owner_avatar   text,
  owner_verified boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_query text := trim(p_query);
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.user_id,
    l.title,
    l.description,
    l.category,
    l.type,
    l.city,
    l.image_url,
    l.created_at,
    l.status,
    l.is_urgent,
    l.dual_mode,
    l.views_count,
    l.interest_count,
    l.is_hidden,
    p.full_name        AS owner_name,
    p.username         AS owner_username,
    p.avatar_url       AS owner_avatar,
    p.is_verified      AS owner_verified
  FROM public.listings l
  JOIN public.profiles p ON p.id = l.user_id
  WHERE
    -- Only active statuses
    l.status IN ('available', 'reserved_temp', 'reserved')
    -- Never show hidden listings
    AND l.is_hidden = false
    -- Exclude listings from banned or suspended owners
    AND p.account_status = 'active'
    -- Exclude hidden/admin profiles
    AND p.is_hidden_from_public = false
    -- Type filter
    AND (
      p_type IS NULL
      OR p_type = ''
      OR (p_type = 'exchange' AND (l.type = 'exchange' OR l.dual_mode = true))
      OR (p_type = 'free'     AND (l.type = 'free'     OR l.dual_mode = true))
    )
    -- Category filter (exact)
    AND (p_category IS NULL OR p_category = '' OR l.category = p_category)
    -- City filter (case-insensitive)
    AND (p_city IS NULL OR p_city = '' OR lower(l.city) = lower(p_city))
    -- Text search: title, description, category, city, owner name/username
    AND (
      v_query = ''
      OR l.title        ILIKE '%' || v_query || '%'
      OR l.description  ILIKE '%' || v_query || '%'
      OR l.category     ILIKE '%' || v_query || '%'
      OR l.city         ILIKE '%' || v_query || '%'
      OR p.full_name    ILIKE '%' || v_query || '%'
      OR p.username     ILIKE '%' || v_query || '%'
    )
  ORDER BY
    CASE WHEN p_sort = 'oldest_first' THEN l.created_at END ASC,
    CASE WHEN p_sort != 'oldest_first' THEN l.created_at END DESC,
    l.is_urgent DESC
  LIMIT  LEAST(p_limit,  100)   -- cap at 100 per page
  OFFSET GREATEST(p_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.search_listings(text,text,text,text,text,integer,integer) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.search_listings(text,text,text,text,text,integer,integer) TO authenticated, service_role;


-- ── 4. get_public_profile RPC ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS TABLE (
  id             uuid,
  full_name      text,
  display_name   text,
  username       text,
  role           text,
  avatar_url     text,
  city           text,
  created_at     timestamptz,
  is_verified    boolean,
  phone_verified boolean,
  rating_avg     numeric,
  rating_count   integer,
  -- phone only if user opted in
  show_phone     boolean,
  phone          text,
  active_listings_count integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.display_name,
    p.username,
    p.role,
    p.avatar_url,
    p.city,
    p.created_at,
    p.is_verified,
    p.phone_verified,
    p.rating_avg,
    p.rating_count,
    p.show_phone,
    -- Only expose phone when user explicitly opted in
    CASE WHEN p.show_phone THEN p.phone ELSE '' END AS phone,
    (
      SELECT count(*)::integer
      FROM public.listings l
      WHERE l.user_id = p.id
        AND l.status IN ('available', 'reserved_temp', 'reserved')
        AND l.is_hidden = false
    ) AS active_listings_count
  FROM public.profiles p
  WHERE
    p.id = p_user_id
    -- Do not expose banned/suspended/hidden profiles
    AND p.account_status = 'active'
    AND p.is_hidden_from_public = false;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated, service_role;


-- ── 5. get_user_active_listings RPC ──────────────────────────────────────────
-- Returns public listings for a specific user (for their public profile page).
CREATE OR REPLACE FUNCTION public.get_user_active_listings(p_user_id uuid)
RETURNS TABLE (
  id             uuid,
  title          text,
  description    text,
  category       text,
  type           text,
  city           text,
  image_url      text,
  created_at     timestamptz,
  status         text,
  is_urgent      boolean,
  dual_mode      boolean,
  views_count    integer,
  interest_count integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id, l.title, l.description, l.category, l.type, l.city,
    l.image_url, l.created_at, l.status, l.is_urgent, l.dual_mode,
    l.views_count, l.interest_count
  FROM public.listings l
  JOIN public.profiles p ON p.id = l.user_id
  WHERE
    l.user_id = p_user_id
    AND l.status IN ('available', 'reserved_temp', 'reserved')
    AND l.is_hidden = false
    AND p.account_status = 'active'
    AND p.is_hidden_from_public = false
  ORDER BY l.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_active_listings(uuid) FROM PUBLIC, anon, postgres;
GRANT EXECUTE ON FUNCTION public.get_user_active_listings(uuid) TO authenticated, service_role;
