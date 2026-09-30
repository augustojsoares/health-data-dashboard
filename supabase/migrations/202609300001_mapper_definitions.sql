-- Versioned mapper configurations and immutable run evidence. Defaults are
-- shipped in code; this table stores per-user copies and future overrides.
create table public.health_mapper_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  mapper_id text not null check (char_length(trim(mapper_id)) > 0),
  source text not null check (char_length(trim(source)) > 0),
  version integer not null check (version > 0),
  name text not null check (char_length(trim(name)) > 0),
  definition jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, mapper_id, version)
);

create table public.health_mapping_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  mapper_id text not null,
  mapper_version integer not null,
  source text not null,
  source_identity text,
  status text not null check (status in ('accepted', 'rejected')),
  issues jsonb not null default '[]'::jsonb,
  output jsonb,
  created_at timestamptz not null default now()
);
create index health_mapping_runs_owner_created on public.health_mapping_runs (owner_id, created_at desc);

alter table public.health_mapper_definitions enable row level security;
alter table public.health_mapping_runs enable row level security;
create policy "users manage own mapper definitions" on public.health_mapper_definitions for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "users read own mapping runs" on public.health_mapping_runs for select to authenticated using (owner_id = auth.uid());
grant select, insert, update, delete on public.health_mapper_definitions to authenticated;
grant select on public.health_mapping_runs to authenticated;
