-- Sources are extensible. `primary` wins when equivalent observations overlap.
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
