-- 0002_picks_results.sql
-- Picks, results, and a derived user_points view powering the Wall.

create table if not exists public.picks (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  week_id     text not null,           -- ISO week id, e.g. "2026-W16"
  game_id     text not null,           -- ESPN event id (or static-N in dev)
  pick        text not null check (pick in ('left', 'right')),
  created_at  timestamptz not null default now(),
  unique (user_id, week_id, game_id)
);

create index if not exists picks_week_game_idx on public.picks (week_id, game_id);
create index if not exists picks_user_week_idx on public.picks (user_id, week_id);

alter table public.picks enable row level security;

drop policy if exists "picks select own"   on public.picks;
drop policy if exists "picks insert own"   on public.picks;
drop policy if exists "picks update own"   on public.picks;
drop policy if exists "picks delete own"   on public.picks;
drop policy if exists "picks select all"   on public.picks;

create policy "picks insert own"
  on public.picks for insert
  with check (auth.uid() = user_id);

create policy "picks update own"
  on public.picks for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "picks delete own"
  on public.picks for delete
  using (auth.uid() = user_id);

-- Picks are readable to everyone — the Wall computes consensus client-side.
-- If you want strict privacy, replace with a `select own` policy and aggregate
-- via a SECURITY DEFINER function instead.
create policy "picks select all"
  on public.picks for select
  using (true);


create table if not exists public.results (
  game_id     text primary key,
  winner      text not null check (winner in ('left', 'right')),
  recorded_at timestamptz not null default now(),
  source      text                                  -- e.g. "espn-scoreboard"
);

alter table public.results enable row level security;

drop policy if exists "results select all" on public.results;
create policy "results select all"
  on public.results for select
  using (true);

-- Writes to results come from the service-role key (cron / Action). RLS
-- intentionally has no INSERT/UPDATE policy for anon or authenticated users.


-- Derived: total points per user.
-- Rules mirror src/scoring.js — 10 per correct pick, 5 bonus per perfect week
-- with at least 3 scored picks.
create or replace view public.user_points as
with scored as (
  select
    p.user_id,
    p.week_id,
    p.game_id,
    p.pick,
    r.winner,
    case when r.winner is not null and r.winner = p.pick then 1 else 0 end as hit,
    case when r.winner is not null then 1 else 0 end as scored
  from public.picks p
  left join public.results r on r.game_id = p.game_id
),
weekly as (
  select
    user_id,
    week_id,
    sum(hit)    as hits,
    sum(scored) as scored_picks,
    case
      when sum(scored) >= 3 and sum(scored) = sum(hit) then 1
      else 0
    end as perfect_bonus
  from scored
  group by user_id, week_id
)
select
  w.user_id,
  sum(w.hits * 10 + w.perfect_bonus * 5) as points,
  sum(w.hits)          as total_hits,
  count(*)             as scored_weeks
from weekly w
group by w.user_id;

grant select on public.user_points to anon, authenticated;


-- Public leaderboard view: joins user_points with profiles_public so the Wall
-- can pull standings in one query without exposing phone numbers.
create or replace view public.leaderboard as
  select
    pp.user_id,
    pp.display_name,
    coalesce(up.points, 0)        as points,
    coalesce(up.total_hits, 0)    as total_hits,
    coalesce(up.scored_weeks, 0)  as scored_weeks
  from public.profiles_public pp
  left join public.user_points up on up.user_id = pp.user_id;

grant select on public.leaderboard to anon, authenticated;


-- Consensus view: per (week_id, game_id), how many users picked left vs right.
-- Cheap aggregation the Wall can read once per page load.
create or replace view public.consensus as
  select
    week_id,
    game_id,
    sum(case when pick = 'left'  then 1 else 0 end) as left_count,
    sum(case when pick = 'right' then 1 else 0 end) as right_count,
    count(*)                                        as total
  from public.picks
  group by week_id, game_id;

grant select on public.consensus to anon, authenticated;
