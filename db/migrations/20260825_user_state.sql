-- The signed-in user's whole record, as one jsonb blob per account. Row-level
-- security scopes every query to the caller's own row, so the client reads it
-- without passing an id (see src/lib/user.js).
--
-- This table predates the migration files; this is its live definition.

create table if not exists public.user_state (
  user_id uuid primary key references neon_auth."user" (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_state_updated_at on public.user_state;
create trigger user_state_updated_at
  before update on public.user_state
  for each row execute function public.set_updated_at();

alter table public.user_state enable row level security;

drop policy if exists user_state_select on public.user_state;
create policy user_state_select on public.user_state
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists user_state_insert on public.user_state;
create policy user_state_insert on public.user_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists user_state_update on public.user_state;
create policy user_state_update on public.user_state
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists user_state_delete on public.user_state;
create policy user_state_delete on public.user_state
  for delete to authenticated using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.user_state to authenticated;
