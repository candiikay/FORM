-- 0001_profiles.sql
-- One row per authenticated user, keyed off auth.users.id.
-- Stores the display name shown on the leaderboard / share cards.

create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  phone        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists profiles_phone_idx on public.profiles (phone);

alter table public.profiles enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own"
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public-readable view of just the display name, used by the Wall page to
-- render the leaderboard. Phone numbers and ids stay private.
create or replace view public.profiles_public as
  select user_id, display_name
  from public.profiles
  where coalesce(display_name, '') <> '';

grant select on public.profiles_public to anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
