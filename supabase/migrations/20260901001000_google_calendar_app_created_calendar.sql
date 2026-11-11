alter table public.calendar_events
  add column if not exists google_calendar_id text;

drop index if exists public.calendar_events_user_google_event_unique;

create unique index if not exists calendar_events_user_google_calendar_event_unique
  on public.calendar_events (user_id, google_calendar_id, google_event_id)
  where google_event_id is not null;

comment on column public.calendar_events.google_calendar_id is
  'Google Calendar identifier for the app-created RecallMate calendar used for synchronization.';
