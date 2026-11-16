-- ============================================================
-- Who's Got It? — 06 PER-FAMILY "KIDS IN SECRET SANTA" SWITCH
-- Some families draw adults only. On (the default) = kids draw like adults,
-- as before. Off = children stay in the family for wishlists and birthdays
-- but are left out of that family's Secret Santa draw.
-- Change it in the app: People tab → Families → "Kids in Secret Santa".
-- Safe to re-run.
-- ============================================================
alter table public.sides add column if not exists santa_kids boolean not null default true;
