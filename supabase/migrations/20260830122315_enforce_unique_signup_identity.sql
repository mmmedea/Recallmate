alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  drop constraint if exists profiles_username_format_check;

alter table public.profiles
  add constraint profiles_username_format_check
  check (username is null or username ~ '^[A-Za-z0-9_]{3,30}$');

-- Claim each historical username once. Any already-duplicated metadata remains
-- visible to the availability check but cannot create another profile claim.
with ranked_usernames as (
  select
    id,
    nullif(trim(raw_user_meta_data->>'username'), '') as username,
    row_number() over (
      partition by lower(nullif(trim(raw_user_meta_data->>'username'), ''))
      order by created_at, id
    ) as duplicate_rank
  from auth.users
  where nullif(trim(raw_user_meta_data->>'username'), '') is not null
)
update public.profiles as profile
set username = ranked.username
from ranked_usernames as ranked
where profile.id = ranked.id
  and ranked.duplicate_rank = 1
  and ranked.username ~ '^[A-Za-z0-9_]{3,30}$';

create unique index if not exists profiles_username_unique_ci
  on public.profiles (lower(username))
  where username is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, username)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    nullif(trim(new.raw_user_meta_data->>'username'), '')
  );

  insert into public.user_entitlements (user_id, tier)
  values (new.id, 'free');

  return new;
end;
$$;

create or replace function public.sync_profile_username_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set
    username = nullif(trim(new.raw_user_meta_data->>'username'), ''),
    email = new.email,
    updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_identity_updated on auth.users;
create trigger on_auth_user_profile_identity_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute procedure public.sync_profile_username_from_auth();

create or replace function public.check_signup_availability(
  p_email text,
  p_username text,
  p_exclude_user_id uuid default null
)
returns table(email_exists boolean, username_exists boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from auth.users as account
      where lower(account.email) = lower(trim(p_email))
        and (p_exclude_user_id is null or account.id <> p_exclude_user_id)
    ),
    exists (
      select 1
      from auth.users as account
      where lower(nullif(trim(account.raw_user_meta_data->>'username'), '')) = lower(trim(p_username))
        and (p_exclude_user_id is null or account.id <> p_exclude_user_id)
    ) or exists (
      select 1
      from public.profiles as profile
      where lower(profile.username) = lower(trim(p_username))
        and (p_exclude_user_id is null or profile.id <> p_exclude_user_id)
    );
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_profile_username_from_auth() from public, anon, authenticated;
revoke execute on function public.check_signup_availability(text, text, uuid) from public, anon, authenticated;
grant execute on function public.check_signup_availability(text, text, uuid) to service_role;

notify pgrst, 'reload schema';
