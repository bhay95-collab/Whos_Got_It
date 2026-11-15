-- ============================================================
-- Who's Got It? — 05 FAMILY THEMES
-- Gives each family its own accent colour and an optional welcome line.
-- Run once (safe to re-run). Change colours / lines later in the app: People tab > Family names.
-- ============================================================
alter table public.sides add column if not exists accent  text not null default 'coral';
alter table public.sides add column if not exists welcome text;

alter table public.sides drop constraint if exists sides_accent_check;
alter table public.sides add  constraint sides_accent_check
  check (accent in ('coral','teal','indigo','plum','forest','honey'));

-- starting colours (only applied while a side is still on the default)
update public.sides set accent = 'teal' where id = 'hm' and accent = 'coral';
update public.sides set accent = 'plum' where id = 'hb' and accent = 'coral';
