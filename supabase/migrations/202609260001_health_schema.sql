create extension if not exists pgcrypto;

create table public.health_observations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  source text not null check (char_length(trim(source)) > 0),
  source_identity text not null,
  logical_identity text,
  source_timestamp timestamptz not null,
  local_date date not null,
  source_timezone text not null default 'UTC',
  observation_type text not null,
  raw_measurement jsonb not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_identity)
);
create index health_observations_owner_timestamp on public.health_observations (owner_id, source_timestamp desc);
create index health_observations_logical on public.health_observations (owner_id, logical_identity) where logical_identity is not null;

create table public.health_metrics (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.health_observations(id) on delete cascade,
  owner_id uuid not null,
  metric_key text not null,
  value_numeric numeric not null,
  unit text,
  is_derived boolean not null default false,
  source_timestamp timestamptz not null,
  created_at timestamptz not null default now(),
  unique (observation_id, metric_key)
);
create index health_metrics_owner_key_timestamp on public.health_metrics (owner_id, metric_key, source_timestamp desc);

create table public.ingestion_raw_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  unique (source, payload_hash)
);

-- Source records are never discarded. This view chooses one display record for
-- each measurement grouping according to configurable source priority.
create or replace view public.dashboard_metrics with (security_invoker = true) as
with ranked_observations as (
  select o.*, row_number() over (
    partition by o.owner_id, coalesce(o.logical_identity, o.source || ':' || o.source_identity)
    order by case o.source when 'primary' then 100 else 10 end desc, o.updated_at desc
  ) as source_rank
  from public.health_observations o
)
select m.metric_key, m.value_numeric, m.unit, m.is_derived, o.source_timestamp, o.local_date, o.source, o.provenance
from ranked_observations o join public.health_metrics m on m.observation_id = o.id
where o.source_rank = 1;

grant select on public.dashboard_metrics to authenticated;
grant select on public.health_observations, public.health_metrics to authenticated;

alter table public.health_observations enable row level security;
alter table public.health_metrics enable row level security;
alter table public.ingestion_raw_events enable row level security;

-- Each authenticated user can read only their own data. The service-role key
-- used by ingestion bypasses RLS and must remain server-side.
create policy "users read own observations" on public.health_observations for select to authenticated using (owner_id = auth.uid());
create policy "users read own metrics" on public.health_metrics for select to authenticated using (owner_id = auth.uid());
create policy "no raw event access from browser" on public.ingestion_raw_events for select to authenticated using (false);
