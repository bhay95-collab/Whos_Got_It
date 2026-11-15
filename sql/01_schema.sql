-- ============================================================
-- Who's Got It? — 01 SCHEMA (tables only)
-- Run in: Supabase dashboard > SQL Editor > New query > paste > Run.
-- Safe to re-run: every statement checks before creating.
-- ============================================================

create table if not exists public.sides (
  id        text primary key,            -- 'hm' | 'hb'
  name      text not null,
  sort      int  not null default 0
);

create table if not exists public.households (
  id    uuid primary key default gen_random_uuid(),
  name  text not null
);

create table if not exists public.people (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  household_id  uuid references public.households(id) on delete set null,
  spouse_id     uuid references public.people(id)      on delete set null,
  is_child      boolean not null default false,   -- children have no login; an adult in the household manages them
  is_admin      boolean not null default false,
  active        boolean not null default true,
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  birth_month   smallint check (birth_month between 1 and 12),
  birth_day     smallint check (birth_day between 1 and 31),
  birth_year    smallint,
  email         text,
  color         text not null default 'blue',     -- avatar pastel: blue pink lilac green yellow peach
  photo_url     text,
  sizes         jsonb not null default '{}'::jsonb, -- "My details" card
  created_at    timestamptz not null default now()
);

create table if not exists public.person_sides (
  person_id  uuid not null references public.people(id) on delete cascade,
  side_id    text not null references public.sides(id) on delete cascade,
  primary key (person_id, side_id)
);

create table if not exists public.wishlist_items (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references public.people(id) on delete cascade,   -- whose list
  title        text not null,
  url          text,
  image_url    text,
  price        numeric(10,2),
  note         text,
  priority     smallint not null default 0 check (priority between 0 and 2),  -- 2 = really want
  added_by     uuid references public.people(id) on delete set null,
  created_at   timestamptz not null default now(),
  archived_at  timestamptz                                                    -- got it / given / no longer wanted
);
create index if not exists wishlist_items_person_idx on public.wishlist_items(person_id);

-- A claim = "I'm thinking about it" or "I bought it". item_id is null for off-list gifts.
create table if not exists public.claims (
  id             uuid primary key default gen_random_uuid(),
  recipient_id   uuid not null references public.people(id) on delete cascade,
  item_id        uuid references public.wishlist_items(id) on delete set null,
  claimer_id     uuid not null references public.people(id) on delete cascade,
  description    text not null,                       -- snapshot of the item title, or the off-list gift
  state          text not null check (state in ('thinking','bought')),
  occasion_type  text not null check (occasion_type in ('birthday','christmas')),
  occasion_date  date not null,                       -- once this passes the gift is "given" and drops off
  created_at     timestamptz not null default now()
);
create index if not exists claims_recipient_idx on public.claims(recipient_id);
create unique index if not exists claims_one_bought_per_item
  on public.claims(item_id) where state = 'bought' and item_id is not null;

-- Group gifts ("chip in"). UI comes in a later build step; tables are here so the schema is locked.
create table if not exists public.chip_ins (
  id             uuid primary key default gen_random_uuid(),
  recipient_id   uuid not null references public.people(id) on delete cascade,
  item_id        uuid references public.wishlist_items(id) on delete set null,
  organiser_id   uuid not null references public.people(id) on delete cascade,
  description    text not null,
  target_amount  numeric(10,2) not null,
  occasion_type  text not null check (occasion_type in ('birthday','christmas')),
  occasion_date  date not null,
  side_id        text not null references public.sides(id),
  created_at     timestamptz not null default now()
);
create table if not exists public.chip_in_pledges (
  chip_in_id  uuid not null references public.chip_ins(id) on delete cascade,
  person_id   uuid not null references public.people(id) on delete cascade,
  amount      numeric(10,2) not null check (amount > 0),
  primary key (chip_in_id, person_id)
);

-- Secret Santa. Written only by the daily job (service role); read via RLS rules below.
create table if not exists public.santa_draws (
  id        uuid primary key default gen_random_uuid(),
  side_id   text not null references public.sides(id),
  year      int  not null,
  drawn_at  timestamptz not null default now(),
  unique (side_id, year)
);
create table if not exists public.santa_pairs (
  draw_id       uuid not null references public.santa_draws(id) on delete cascade,
  giver_id      uuid not null references public.people(id) on delete cascade,
  recipient_id  uuid not null references public.people(id) on delete cascade,
  primary key (draw_id, giver_id),
  unique (draw_id, recipient_id)
);

-- Outgoing emails. Written and sent by the daily job only (service role). No app access.
create table if not exists public.email_queue (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,                 -- 'birthday' | 'santa'
  to_email    text not null,
  subject     text not null,
  html        text not null,
  text_body   text not null,
  dedupe_key  text not null unique,          -- stops the same email being queued twice
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  error       text
);
