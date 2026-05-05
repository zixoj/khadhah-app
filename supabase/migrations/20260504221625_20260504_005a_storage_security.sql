-- Storage: make bucket private and tighten policies

UPDATE storage.buckets
SET public = false
WHERE id = 'listing-images';

DROP POLICY IF EXISTS "Anyone can view listing images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload listing images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own listing images" ON storage.objects;

-- SELECT: authenticated only, no anon
CREATE POLICY "Authenticated users can view listing images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'listing-images');

-- INSERT: user can only upload to their own user-id folder
CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: needed for avatar upsert
CREATE POLICY "Users can update own folder objects"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: owner folder only
CREATE POLICY "Users can delete own folder objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
