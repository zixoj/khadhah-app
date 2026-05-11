/*
  # Create ads-images storage bucket with full RLS policies

  ## Summary
  Creates a dedicated public storage bucket "ads-images" for ad/listing image uploads,
  replacing direct use of listing-images for new uploads. The bucket is public so
  image URLs work without authentication for all viewers.

  ## Bucket
  - Name: ads-images
  - Public: true (public read via URL, no auth needed for GET)
  - File size limit: 5 MB
  - Allowed MIME types: jpeg, jpg, png, webp, heic, heif

  ## Storage RLS Policies
  1. Authenticated users can INSERT into their own folder (path starts with their user id)
  2. Authenticated users can UPDATE their own folder objects
  3. Authenticated users can DELETE their own folder objects
  4. Everyone (public + anon) can SELECT/read all objects in this bucket
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ads-images',
  'ads-images',
  true,
  5242880,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
  ];

-- Anyone can read images (bucket is public, but RLS still runs on storage.objects)
CREATE POLICY "ads-images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ads-images');

-- Authenticated users can upload to their own folder only
CREATE POLICY "ads-images: authenticated upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ads-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update only their own files
CREATE POLICY "ads-images: authenticated update own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'ads-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'ads-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete only their own files
CREATE POLICY "ads-images: authenticated delete own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ads-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
