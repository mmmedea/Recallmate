-- Bind every private storage object to both its Supabase owner and UUID path prefix.
DROP POLICY IF EXISTS "Users can upload their own study materials" ON storage.objects;
CREATE POLICY "Users can upload their own study materials"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'study_materials'
  AND owner_id = auth.uid()::text
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can view their own study materials" ON storage.objects;
CREATE POLICY "Users can view their own study materials"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'study_materials'
  AND owner_id = auth.uid()::text
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can insert their own reviewers" ON storage.objects;
CREATE POLICY "Users can insert their own reviewers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reviewers'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can view their own reviewers" ON storage.objects;
CREATE POLICY "Users can view their own reviewers"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'reviewers'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] = auth.uid()::text
);
