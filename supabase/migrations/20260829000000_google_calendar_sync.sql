alter table public.calendar_events
  add column if not exists google_event_id text,
  add column if not exists google_synced_at timestamptz;

create unique index if not exists calendar_events_user_google_event_unique
  on public.calendar_events (user_id, google_event_id)
  where google_event_id is not null;

comment on column public.calendar_events.google_event_id is
  'Google Calendar event identifier used to update an event on later manual syncs.';

comment on column public.calendar_events.google_synced_at is
  'Most recent successful one-way RecallMate to Google Calendar synchronization.';
