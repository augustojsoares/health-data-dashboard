create table public.health_preferences (
  owner_id uuid primary key,
  theme text not null default 'light' check (theme in ('light', 'dark', 'permit', 'aurora')),
  updated_at timestamptz not null default now()
);

alter table public.health_preferences enable row level security;

create policy "users read own preferences"
  on public.health_preferences for select to authenticated
  using (owner_id = auth.uid());

create policy "users add own preferences"
  on public.health_preferences for insert to authenticated
  with check (owner_id = auth.uid());

create policy "users update own preferences"
  on public.health_preferences for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

grant select, insert, update on public.health_preferences to authenticated;
