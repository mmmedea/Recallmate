-- Student-facing priority labels for calendar notes and reminders.
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_priority_check;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_priority_check
  CHECK (priority IN ('normal', 'important', 'urgent'));

ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_event_type_check;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_event_type_check
  CHECK (event_type IN ('study', 'review', 'quiz', 'exam', 'assignment', 'note', 'reminder', 'custom'));
