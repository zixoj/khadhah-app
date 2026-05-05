/*
  # Create listings table and storage bucket

  1. New Tables
    - `listings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users)
      - `title` (text)
      - `description` (text)
      - `category` (text)
      - `type` (text) - 'exchange' or 'free'
      - `city` (text)
      - `phone` (text)
      - `delivery_method` (text) - 'pickup' | 'delivery_agent' | 'direct_contact'
      - `image_url` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `listings`
    - Anyone authenticated can read all listings
    - Only the owner can insert/update their listing
    - Only the owner can delete their listing

  3. Storage
    - Create `listing-images` bucket (public)
    - Policy: authenticated users can upload
    - Policy: anyone can read
*/

-- Create listings table
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'exchange',
  city text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  delivery_method text NOT NULL DEFAULT 'direct_contact',
  image_url text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can view all listings
CREATE POLICY "Authenticated users can view all listings"
  ON listings FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: users can only insert their own listings
CREATE POLICY "Users can insert own listings"
  ON listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can only update their own listings
CREATE POLICY "Users can update own listings"
  ON listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: users can only delete their own listings
CREATE POLICY "Users can delete own listings"
  ON listings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create storage bucket for listing images
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload images
CREATE POLICY "Authenticated users can upload listing images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'listing-images');

-- Storage policy: anyone can view listing images
CREATE POLICY "Anyone can view listing images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'listing-images');

-- Storage policy: owners can delete their images
CREATE POLICY "Users can delete own listing images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);
