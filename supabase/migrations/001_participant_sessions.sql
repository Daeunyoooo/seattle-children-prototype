-- Prototype session store for cross-device save/load.
-- Not for PHI/HIPAA: anon can read and write all rows.

create table if not exists public.participant_sessions (
  session_id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.participant_sessions enable row level security;

drop policy if exists "prototype_anon_select_participant_sessions" on public.participant_sessions;
create policy "prototype_anon_select_participant_sessions"
  on public.participant_sessions
  for select
  to anon
  using (true);

drop policy if exists "prototype_anon_insert_participant_sessions" on public.participant_sessions;
create policy "prototype_anon_insert_participant_sessions"
  on public.participant_sessions
  for insert
  to anon
  with check (true);

drop policy if exists "prototype_anon_update_participant_sessions" on public.participant_sessions;
create policy "prototype_anon_update_participant_sessions"
  on public.participant_sessions
  for update
  to anon
  using (true)
  with check (true);
