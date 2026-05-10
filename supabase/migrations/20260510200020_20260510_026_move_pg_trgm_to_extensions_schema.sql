-- Move pg_trgm extension from public schema to extensions schema.
-- Drop dependent GIN indexes first, move the extension, then recreate the indexes.

DROP INDEX IF EXISTS idx_listings_title_trgm;
DROP INDEX IF EXISTS idx_listings_description_trgm;
DROP INDEX IF EXISTS idx_listings_city_trgm;
DROP INDEX IF EXISTS idx_listings_category_trgm;
DROP INDEX IF EXISTS idx_profiles_username_trgm;
DROP INDEX IF EXISTS idx_profiles_full_name_trgm;

DROP EXTENSION IF EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Recreate GIN trigram indexes
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm
  ON public.listings USING gin (title extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listings_description_trgm
  ON public.listings USING gin (description extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listings_city_trgm
  ON public.listings USING gin (city extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listings_category_trgm
  ON public.listings USING gin (category extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm
  ON public.profiles USING gin (username extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm
  ON public.profiles USING gin (full_name extensions.gin_trgm_ops);
