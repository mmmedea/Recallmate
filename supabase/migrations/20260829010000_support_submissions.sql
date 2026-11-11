create table if not exists public.support_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('feedback', 'report')),
  subject text not null check (char_length(subject) between 1 and 120),
  message text not null check (char_length(message) between 10 and 4000),
  user_email text not null,
  delivery_status text not null default 'received' check (delivery_status in ('received', 'emailed', 'email_failed')),
  created_at timestamptz not null default now()
);

alter table public.support_submissions enable row level security;

-- Submissions only pass through the authenticated server route. Browser clients
-- never receive direct access to the support inbox or other users' messages.
revoke all on table public.support_submissions from anon, authenticated;

create index if not exists support_submissions_user_created_idx
  on public.support_submissions (user_id, created_at desc);
