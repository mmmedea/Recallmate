-- Align the production document contract with upload, extraction, and document chat.
alter table public.documents
  add column if not exists content_type text,
  add column if not exists title text;

update public.documents
set title = coalesce(nullif(title, ''), filename)
where title is null or title = '';

comment on column public.documents.content_type is 'Validated MIME type recorded when a study file is uploaded.';
comment on column public.documents.title is 'User-facing document title; defaults to the original filename.';

notify pgrst, 'reload schema';
