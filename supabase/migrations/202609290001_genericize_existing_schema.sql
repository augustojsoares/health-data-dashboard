-- Apply this migration to projects created from the earlier single-owner schema.
alter table public.health_observations
  drop constraint if exists health_observations_source_check;
alter table public.health_observations
  add constraint health_observations_source_check check (char_length(trim(source)) > 0);
alter table public.health_observations
  alter column source_timezone set default 'UTC';

drop policy if exists "approved Google identity reads observations" on public.health_observations;
drop policy if exists "approved Google identity reads metrics" on public.health_metrics;
drop policy if exists "approved Google identity reads notes" on public.health_notes;
drop policy if exists "approved Google identity adds notes" on public.health_notes;
drop policy if exists "approved Google identity reads manual metrics" on public.health_manual_metrics;
drop policy if exists "approved Google identity adds manual metrics" on public.health_manual_metrics;
drop policy if exists "approved Google identity reads preferences" on public.health_preferences;
drop policy if exists "approved Google identity changes preferences" on public.health_preferences;
drop policy if exists "approved Google identity updates preferences" on public.health_preferences;
drop policy if exists "users read own observations" on public.health_observations;
drop policy if exists "users read own metrics" on public.health_metrics;
drop policy if exists "users read own notes" on public.health_notes;
drop policy if exists "users add own notes" on public.health_notes;
drop policy if exists "users read own manual metrics" on public.health_manual_metrics;
drop policy if exists "users add own manual metrics" on public.health_manual_metrics;
drop policy if exists "users read own preferences" on public.health_preferences;
drop policy if exists "users add own preferences" on public.health_preferences;
drop policy if exists "users update own preferences" on public.health_preferences;

create policy "users read own observations" on public.health_observations for select to authenticated using (owner_id = auth.uid());
create policy "users read own metrics" on public.health_metrics for select to authenticated using (owner_id = auth.uid());
create policy "users read own notes" on public.health_notes for select to authenticated using (owner_id = auth.uid());
create policy "users add own notes" on public.health_notes for insert to authenticated with check (owner_id = auth.uid());
create policy "users read own manual metrics" on public.health_manual_metrics for select to authenticated using (owner_id = auth.uid());
create policy "users add own manual metrics" on public.health_manual_metrics for insert to authenticated with check (owner_id = auth.uid());
create policy "users read own preferences" on public.health_preferences for select to authenticated using (owner_id = auth.uid());
create policy "users add own preferences" on public.health_preferences for insert to authenticated with check (owner_id = auth.uid());
create policy "users update own preferences" on public.health_preferences for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

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
