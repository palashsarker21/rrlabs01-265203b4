
-- Cadence fields
alter table public.recovery_events
  add column if not exists cadence_step int not null default 0,
  add column if not exists next_run_at timestamptz,
  add column if not exists abandoned_at timestamptz;

create index if not exists recovery_events_due_idx
  on public.recovery_events (next_run_at)
  where status in ('new','analyzing','recovering','failed');

-- Templates
create table if not exists public.recovery_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  step int not null,
  channel public.recovery_channel not null,
  subject text,
  body_text text,
  body_html text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, step, channel)
);
grant select, insert, update, delete on public.recovery_templates to authenticated;
grant all on public.recovery_templates to service_role;
alter table public.recovery_templates enable row level security;
create policy "workspace members read templates" on public.recovery_templates
  for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "managers write templates" on public.recovery_templates
  for all to authenticated
  using (public.can_manage_workspace(workspace_id, auth.uid()))
  with check (public.can_manage_workspace(workspace_id, auth.uid()));
create trigger recovery_templates_set_updated_at
  before update on public.recovery_templates
  for each row execute function public.tg_set_updated_at();

-- Extensions for scheduled cadence dispatch
create extension if not exists pg_cron;
create extension if not exists pg_net;
