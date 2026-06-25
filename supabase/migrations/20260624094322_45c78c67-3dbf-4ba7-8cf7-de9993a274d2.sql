
CREATE POLICY "Anyone can view gjenglemt images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'gjenglemt-images');

CREATE POLICY "Authenticated can upload gjenglemt images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gjenglemt-images');

CREATE POLICY "Authenticated can update gjenglemt images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'gjenglemt-images');

CREATE POLICY "Authenticated can delete gjenglemt images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'gjenglemt-images');
