-- Usernames, friendships, per-title watch-together shares, and the shared
-- marks that make one person's "watched" land in the other's record.
--
-- The shape to hold on to: a user's own record still lives in `user_state` as
-- one jsonb blob. Shared marks live here instead, in their own rows, and the
-- client reads the union of the two. That is what makes "start fresh from
-- now" true -- pairing up copies nothing, and only marks made after the share
-- is accepted are visible to both -- and it keeps every write scoped to the
-- writer's own rows, so no one ever needs permission to edit someone else's
-- record.

-- --------------------------------------------------------------------------
-- profiles: the username directory
-- --------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);

-- Usernames are compared case-insensitively, but stored as typed.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- Usernames are handles: any signed-in user can resolve one, which is what
-- makes "add by username" and naming a friend in the UI possible. Nothing
-- else about an account is exposed here.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Sign-up needs to check a username before there is a session to check it
-- with, so availability goes through a function rather than a select.
create or replace function public.username_available(p_username text)
returns boolean language sql security definer stable set search_path = public as $$
  select p_username ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles p where lower(p.username) = lower(p_username));
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- --------------------------------------------------------------------------
-- friendships
-- --------------------------------------------------------------------------

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_distinct check (requester <> addressee)
);

-- One row per pair, whichever direction it was sent in: this is what stops a
-- second request crossing the first.
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;

drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));

drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships
  for insert to authenticated with check (requester = auth.uid() and status = 'pending');

-- Only the person who was asked can accept, and accepting is the only edit.
drop policy if exists friendships_accept on public.friendships;
create policy friendships_accept on public.friendships
  for update to authenticated
  using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');

-- Declining a request, withdrawing one, and unfriending are all the same row
-- going away, and either side may do it.
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships
  for delete to authenticated using (auth.uid() in (requester, addressee));

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- --------------------------------------------------------------------------
-- watch_shares: one title, watched together by two friends
-- --------------------------------------------------------------------------

create table if not exists public.watch_shares (
  id uuid primary key default gen_random_uuid(),
  title_id text not null,
  inviter uuid not null references auth.users (id) on delete cascade,
  invitee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint watch_shares_distinct check (inviter <> invitee),
  constraint watch_shares_title_format check (title_id ~ '^(tv|movie)-[0-9]+$')
);

-- A pair can have only one live share per title. Ended shares are exempt, so
-- the same two people can start watching a show together again later without
-- disturbing the record of the last time -- the new share is a new row.
create unique index if not exists watch_shares_live_key
  on public.watch_shares (title_id, least(inviter, invitee), greatest(inviter, invitee))
  where status <> 'ended';

alter table public.watch_shares enable row level security;

drop policy if exists watch_shares_select on public.watch_shares;
create policy watch_shares_select on public.watch_shares
  for select to authenticated using (auth.uid() in (inviter, invitee));

-- You can only propose watching something with someone who is already a friend.
drop policy if exists watch_shares_insert on public.watch_shares;
create policy watch_shares_insert on public.watch_shares
  for insert to authenticated
  with check (inviter = auth.uid() and status = 'pending' and public.are_friends(inviter, invitee));

-- The invitee accepts; either side ends it.
drop policy if exists watch_shares_update on public.watch_shares;
create policy watch_shares_update on public.watch_shares
  for update to authenticated
  using (auth.uid() in (inviter, invitee))
  with check (
    (status = 'accepted' and invitee = auth.uid())
    or status = 'ended'
  );

-- Declining or withdrawing an invitation that was never accepted removes it.
-- An accepted share is only ever ended, never deleted, because its marks are
-- the other person's history too.
drop policy if exists watch_shares_delete on public.watch_shares;
create policy watch_shares_delete on public.watch_shares
  for delete to authenticated using (auth.uid() in (inviter, invitee) and status = 'pending');

-- --------------------------------------------------------------------------
-- shared_marks: the watched episodes, films and watchlist entries that belong
-- to a share rather than to one person
-- --------------------------------------------------------------------------

create table if not exists public.shared_marks (
  share_id uuid not null references public.watch_shares (id) on delete cascade,
  kind text not null check (kind in ('episode', 'movie', 'watchlist')),
  key text not null,
  marked_by uuid not null references auth.users (id) on delete cascade,
  marked_at timestamptz not null default now(),
  primary key (share_id, kind, key)
);

-- Realtime sends only the primary key of a deleted row unless the whole old
-- row is replicated -- and an Undo is a delete, so the subscriber needs the
-- share id and key to act on it.
alter table public.shared_marks replica identity full;

alter table public.shared_marks enable row level security;

-- Reading covers ended shares as well: when a share ends, each side folds the
-- marks it holds into their own record, and they need to be able to read them
-- to do it.
create or replace function public.share_member(p_share_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.watch_shares s
    where s.id = p_share_id and auth.uid() in (s.inviter, s.invitee)
  );
$$;

create or replace function public.share_live(p_share_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.watch_shares s
    where s.id = p_share_id and s.status = 'accepted' and auth.uid() in (s.inviter, s.invitee)
  );
$$;

grant execute on function public.share_member(uuid) to authenticated;
grant execute on function public.share_live(uuid) to authenticated;

drop policy if exists shared_marks_select on public.shared_marks;
create policy shared_marks_select on public.shared_marks
  for select to authenticated using (public.share_member(share_id));

drop policy if exists shared_marks_insert on public.shared_marks;
create policy shared_marks_insert on public.shared_marks
  for insert to authenticated
  with check (marked_by = auth.uid() and public.share_live(share_id));

-- Un-marking is symmetric with marking: either member may take a mark back,
-- whoever made it.
drop policy if exists shared_marks_delete on public.shared_marks;
create policy shared_marks_delete on public.shared_marks
  for delete to authenticated using (public.share_live(share_id));

-- --------------------------------------------------------------------------
-- grants and realtime
-- --------------------------------------------------------------------------

grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.profiles to anon;
grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, update, delete on public.watch_shares to authenticated;
grant select, insert, delete on public.shared_marks to authenticated;

-- A friend's mark should land while you are both watching, not on next load.
do $$
begin
  begin
    alter publication supabase_realtime add table public.shared_marks;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.watch_shares;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.friendships;
  exception when duplicate_object then null;
  end;
end $$;
