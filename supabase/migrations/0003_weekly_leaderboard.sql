-- 0003_weekly_leaderboard.sql
-- A per-week leaderboard view so the Wall can show "this week" standings
-- alongside the existing season totals.
--
-- Mirrors the scoring rules in src/scoring.js and the season `user_points`
-- view in 0002: 10 per correct pick, +5 perfect-week bonus when at least 3
-- picks were scored and they were all correct. Unscored weeks (results not
-- yet recorded) collapse to 0 points so they don't pollute the board.

create or replace view public.weekly_leaderboard as
with scored as (
  select
    p.user_id,
    p.week_id,
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
  pp.user_id,
  pp.display_name,
  w.week_id,
  (w.hits * 10 + w.perfect_bonus * 5) as points,
  w.hits          as total_hits,
  w.scored_picks  as scored_picks,
  w.perfect_bonus as perfect_bonus
from weekly w
join public.profiles_public pp on pp.user_id = w.user_id;

grant select on public.weekly_leaderboard to anon, authenticated;
