
CREATE POLICY "Anyone can upload participant images"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'participant-images');

CREATE POLICY "Anyone can update participant images"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'participant-images');

CREATE POLICY "Anyone can read participant images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'participant-images');
