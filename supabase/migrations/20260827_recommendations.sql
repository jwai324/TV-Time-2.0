-- Recommendations: one friend puts a title in front of another, and the other
-- decides what to do with it.
--
-- The shape follows `watch_shares`: a row of its own, readable by both sides,
-- writable only by the side whose turn it is. The sender creates it; from then
-- on only the recipient touches it, because the decision is theirs. Nothing is
-- ever written into anybody else's record -- accepting is the recipient's own
-- client adding the title to their own watchlist.
--
-- Deferring ("ask me in three days") is not a fourth status. The row stays
-- pending and `remind_at` says when it comes back, so a deferred
-- recommendation is still an open question rather than a decision, and the
-- client shows it again the moment that time passes.

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  title_id text not null,
  sender uuid not null references auth.users (id) on delete cascade,
  recipient uuid not null references auth.users (id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'ignored')),
  -- Null until deferred; then the moment the prompt is due again.
  remind_at timestamptz,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint recommendations_distinct check (sender <> recipient),
  constraint recommendations_title_format check (title_id ~ '^(tv|movie)-[0-9]+$'),
  constraint recommendations_note_length check (note is null or char_length(note) <= 280)
);

-- One open recommendation per title, per direction. Answered ones are exempt,
-- so a friend who let one go by can be sent the same title again later --
-- that is a new row, and the old answer is left as it was.
create unique index if not exists recommendations_open_key
  on public.recommendations (title_id, sender, recipient)
  where status = 'pending';

create index if not exists recommendations_recipient_idx
  on public.recommendations (recipient, status);

alter table public.recommendations enable row level security;

-- Realtime sends only the primary key of a deleted row unless the whole old
-- row is replicated -- and a withdrawal is a delete, so the recipient's
-- subscription needs the recipient column to know the row was theirs.
alter table public.recommendations replica identity full;

drop policy if exists recommendations_select on public.recommendations;
create policy recommendations_select on public.recommendations
  for select to authenticated using (auth.uid() in (sender, recipient));

-- You can only recommend something to someone who is already a friend, and
-- only ever in your own name.
drop policy if exists recommendations_insert on public.recommendations;
create policy recommendations_insert on public.recommendations
  for insert to authenticated
  with check (
    sender = auth.uid()
    and status = 'pending'
    and remind_at is null
    and public.are_friends(sender, recipient)
  );

-- Answering is the recipient's alone: watchlist it, pass on it, or push the
-- question out. The sender cannot decide for them, and cannot re-open a
-- decision they have made.
drop policy if exists recommendations_respond on public.recommendations;
create policy recommendations_respond on public.recommendations
  for update to authenticated
  using (recipient = auth.uid()) with check (recipient = auth.uid());

-- An update policy sees the old row and the new one, but cannot compare them,
-- so what may change is pinned down here: answering a recommendation must not
-- be a way to rewrite which title it was for or who sent it.
create or replace function public.recommendations_response_only()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id <> old.id
     or new.title_id <> old.title_id
     or new.sender <> old.sender
     or new.recipient <> old.recipient
     or new.created_at <> old.created_at
     or new.note is distinct from old.note then
    raise exception 'only the response to a recommendation may change';
  end if;
  return new;
end;
$$;

drop trigger if exists recommendations_response_only on public.recommendations;
create trigger recommendations_response_only
  before update on public.recommendations
  for each row execute function public.recommendations_response_only();

-- Withdrawing a recommendation the other person has not answered yet, and
-- clearing one you have answered, are both this row going away.
drop policy if exists recommendations_delete on public.recommendations;
create policy recommendations_delete on public.recommendations
  for delete to authenticated
  using (
    (sender = auth.uid() and status = 'pending')
    or (recipient = auth.uid() and status <> 'pending')
  );

grant select, insert, update, delete on public.recommendations to authenticated;

-- A recommendation should arrive while your friend is in the app, not on next
-- load -- the same as a shared mark.
do $$
begin
  begin
    alter publication supabase_realtime add table public.recommendations;
  exception when duplicate_object then null;
  end;
end $$;
