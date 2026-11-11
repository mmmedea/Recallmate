-- Persistent Claude credential health and Reviewer output state-machine enforcement.

create table if not exists public.anthropic_credential_health (
  slot integer primary key check (slot between 0 and 5),
  credential_group text not null check (credential_group in ('primary', 'secondary')),
  priority integer not null,
  status text not null default 'healthy' check (status in ('healthy', 'cooldown', 'disabled')),
  disabled_reason text,
  cooldown_until timestamptz,
  last_error_category text,
  last_failure_at timestamptz,
  last_success_at timestamptz,
  lease_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.anthropic_credential_health enable row level security;

revoke all on table public.anthropic_credential_health from public, anon, authenticated;
grant all on table public.anthropic_credential_health to service_role;

create index if not exists anthropic_credential_health_status_idx
  on public.anthropic_credential_health (status, credential_group, priority);

alter table if exists public.reviewer_outputs
  drop constraint if exists reviewer_outputs_status_check;

alter table if exists public.reviewer_outputs
  add constraint reviewer_outputs_status_check
  check (
    status in (
      'created',
      'quoted',
      'coins_reserved',
      'extracting',
      'normalizing',
      'generating',
      'validating',
      'repairing',
      'rendering',
      'completed',
      'extraction_failed',
      'provider_failed',
      'ai_failed',
      'qa_failed',
      'render_failed',
      'failed',
      'refunded'
    )
  );

create or replace function public.enforce_reviewer_output_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_allowed boolean := false;
begin
  if tg_op = 'INSERT' then
    return new;
  end if;

  if new.status = old.status then
    return new;
  end if;

  v_allowed :=
    case old.status
      when 'created' then new.status in ('quoted', 'coins_reserved', 'extraction_failed', 'provider_failed', 'qa_failed', 'render_failed', 'failed', 'refunded')
      when 'quoted' then new.status in ('coins_reserved', 'extraction_failed', 'provider_failed', 'qa_failed', 'render_failed', 'failed', 'refunded')
      when 'coins_reserved' then new.status in ('extracting', 'normalizing', 'generating', 'provider_failed', 'failed', 'refunded')
      when 'extracting' then new.status in ('normalizing', 'extraction_failed', 'failed', 'refunded')
      when 'normalizing' then new.status in ('generating', 'qa_failed', 'failed', 'refunded')
      when 'generating' then new.status in ('validating', 'provider_failed', 'failed', 'refunded')
      when 'validating' then new.status in ('repairing', 'rendering', 'qa_failed', 'failed', 'refunded')
      when 'repairing' then new.status in ('validating', 'qa_failed', 'failed', 'refunded')
      when 'rendering' then new.status in ('completed', 'render_failed', 'failed', 'refunded')
      when 'extraction_failed' then new.status in ('refunded')
      when 'provider_failed' then new.status in ('refunded')
      when 'qa_failed' then new.status in ('refunded')
      when 'render_failed' then new.status in ('refunded')
      when 'failed' then new.status in ('refunded')
      else false
    end;

  if not v_allowed then
    raise exception 'Illegal reviewer output status transition: % -> %', old.status, new.status
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_reviewer_output_status_transition_trigger on public.reviewer_outputs;

create trigger enforce_reviewer_output_status_transition_trigger
before update of status on public.reviewer_outputs
for each row
execute function public.enforce_reviewer_output_status_transition();

revoke execute on function public.enforce_reviewer_output_status_transition() from public, anon, authenticated;
grant execute on function public.enforce_reviewer_output_status_transition() to service_role;
