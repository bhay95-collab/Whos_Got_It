-- ============================================================
-- Who's Got It? — 04 MARK 2026 AS ALREADY DRAWN
-- This year's Secret Santa was drawn outside the app. Without this, the daily job would
-- see "it's after 1 November and nobody has been drawn" and draw AGAIN, emailing everyone.
-- Run once, BEFORE adding the GitHub secrets. Safe to re-run.
-- (When you have last year's pairings, send them over and they get imported on top of this,
--  so next year's "never the same person" rule has something to check.)
-- ============================================================
insert into public.santa_draws (side_id, year)
select s.id, 2026 from public.sides s
on conflict (side_id, year) do nothing;
