create table public.health_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  local_date date not null,
  note text not null check (char_length(trim(note)) > 0),
  created_at timestamptz not null default now()
);

create table public.health_manual_metrics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  local_date date not null,
  source_timestamp timestamptz not null,
  metric_key text not null,
  value_numeric numeric not null,
  unit text,
  note text,
  created_at timestamptz not null default now()
);

create index health_notes_owner_date on public.health_notes (owner_id, local_date desc);
create index health_manual_metrics_owner_key_date on public.health_manual_metrics (owner_id, metric_key, source_timestamp desc);

create or replace view public.dashboard_metrics with (security_invoker = true) as
with ranked_observations as (
  select o.*, row_number() over (
    partition by o.owner_id, coalesce(o.logical_identity, o.source || ':' || o.source_identity)
    order by case o.source when 'primary' then 100 else 10 end desc, o.updated_at desc
  ) as source_rank
  from public.health_observations o
), source_metrics as (
  select m.metric_key, m.value_numeric, m.unit, m.is_derived, o.source_timestamp, o.local_date, o.source, o.provenance, o.owner_id
  from ranked_observations o join public.health_metrics m on m.observation_id = o.id
  where o.source_rank = 1
), manual_metrics as (
  select metric_key, value_numeric, unit, false as is_derived, source_timestamp, local_date,
    'manual'::text as source, jsonb_build_object('note', note, 'entry_type', 'manual') as provenance, owner_id
  from public.health_manual_metrics
)
select * from source_metrics
union all
select * from manual_metrics;

grant select on public.dashboard_metrics to authenticated;
grant select, insert on public.health_notes to authenticated;
grant select, insert on public.health_manual_metrics to authenticated;

alter table public.health_notes enable row level security;
alter table public.health_manual_metrics enable row level security;

create policy "users read own notes" on public.health_notes for select to authenticated using (owner_id = auth.uid());
create policy "users add own notes" on public.health_notes for insert to authenticated with check (owner_id = auth.uid());
create policy "users read own manual metrics" on public.health_manual_metrics for select to authenticated using (owner_id = auth.uid());
create policy "users add own manual metrics" on public.health_manual_metrics for insert to authenticated with check (owner_id = auth.uid());
