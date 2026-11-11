-- Enforce upload limits at the Storage boundary, not only after upload confirmation.
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/vnd.ms-excel'
    ]
WHERE id = 'study_materials';

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
WHERE id = 'reviewers';
