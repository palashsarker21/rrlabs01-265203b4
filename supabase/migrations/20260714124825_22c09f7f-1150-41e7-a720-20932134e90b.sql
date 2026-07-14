
do $$ begin
  create type public.recovery_event_status as enum ('new', 'analyzing', 'recovering', 'recovered', 'abandoned', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recovery_channel as enum ('email', 'whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recovery_attempt_status as enum ('pending', 'sending', 'sent', 'delivered', 'failed', 'skipped', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_id text,
  provider text not null default 'stripe',
  email text,
  phone text,
  name text,
  currency text,
  locale text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, external_id)
);
grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "workspace members read customers" on public.customers for select to authenticated using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "managers write customers" on public.customers for all to authenticated using (public.can_manage_workspace(workspace_id, auth.uid())) with check (public.can_manage_workspace(workspace_id, auth.uid()));
create trigger customers_set_updated_at before update on public.customers for each row execute function public.tg_set_updated_at();
create index if not exists customers_workspace_idx on public.customers (workspace_id);

create table if not exists public.recovery_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  provider text not null default 'stripe',
  external_event_id text,
  external_object_id text,
  object_type text,
  amount_cents bigint,
  currency text,
  failure_code text,
  failure_message text,
  failure_category text,
  next_action text,
  ai_summary text,
  ai_analysis jsonb not null default '{}'::jsonb,
  status public.recovery_event_status not null default 'new',
  attempts_count int not null default 0,
  recovered_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, external_event_id)
);
grant select, insert, update, delete on public.recovery_events to authenticated;
grant all on public.recovery_events to service_role;
alter table public.recovery_events enable row level security;
create policy "workspace members read events" on public.recovery_events for select to authenticated using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "managers write events" on public.recovery_events for all to authenticated using (public.can_manage_workspace(workspace_id, auth.uid())) with check (public.can_manage_workspace(workspace_id, auth.uid()));
create trigger recovery_events_set_updated_at before update on public.recovery_events for each row execute function public.tg_set_updated_at();
create index if not exists recovery_events_workspace_status_idx on public.recovery_events (workspace_id, status, created_at desc);

create table if not exists public.recovery_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid not null references public.recovery_events(id) on delete cascade,
  step int not null default 1,
  channel public.recovery_channel not null,
  status public.recovery_attempt_status not null default 'pending',
  to_address text,
  subject text,
  body_text text,
  body_html text,
  ai_model text,
  ai_prompt_tokens int,
  ai_completion_tokens int,
  provider_message_id text,
  provider_response jsonb not null default '{}'::jsonb,
  error text,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.recovery_attempts to authenticated;
grant all on public.recovery_attempts to service_role;
alter table public.recovery_attempts enable row level security;
create policy "workspace members read attempts" on public.recovery_attempts for select to authenticated using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "managers write attempts" on public.recovery_attempts for all to authenticated using (public.can_manage_workspace(workspace_id, auth.uid())) with check (public.can_manage_workspace(workspace_id, auth.uid()));
create trigger recovery_attempts_set_updated_at before update on public.recovery_attempts for each row execute function public.tg_set_updated_at();
create index if not exists recovery_attempts_event_idx on public.recovery_attempts (event_id, step);
create index if not exists recovery_attempts_workspace_idx on public.recovery_attempts (workspace_id, created_at desc);
