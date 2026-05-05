-- Fix update_rating_avg: set fixed search_path, restrict execute

CREATE OR REPLACE FUNCTION public.update_rating_avg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
  SET
    rating_avg   = (SELECT COALESCE(AVG(stars), 0) FROM public.ratings WHERE reviewed_id = NEW.reviewed_id),
    rating_count = (SELECT COUNT(*)                FROM public.ratings WHERE reviewed_id = NEW.reviewed_id)
  WHERE id = NEW.reviewed_id;
  RETURN NEW;
END;
$$;

-- Trigger functions should not be callable by end users
REVOKE EXECUTE ON FUNCTION public.update_rating_avg() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_rating_avg() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_rating_avg() FROM authenticated;
