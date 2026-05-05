/*
  # Add city column to posts

  1. Modified Tables
    - `posts`
      - Added `city` (text) column for the city/location of the item

  2. Security
    - No changes to RLS policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'city'
  ) THEN
    ALTER TABLE posts ADD COLUMN city text DEFAULT '';
  END IF;
END $$;
