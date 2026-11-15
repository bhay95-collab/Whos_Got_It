-- ============================================================
-- Who's Got It? — 02 SECURITY (helper functions, row-level rules, grants, photo storage)
-- Run AFTER 01_schema.sql. Safe to re-run.
--
-- What the rules do, in plain words:
--  * You must be signed in to see anything (except the list of names on the sign-in screen).
--  * Everyone can see everyone's wishlist.
--  * Nobody can see what has been bought FOR them. Enforced here in the database,
--    so even someone poking around in browser dev tools cannot spoil a surprise.
--  * You can edit your own profile and list. Parents can edit their kids' (people with is_child = true
--    in the same household). The admin can edit anyone.
--  * Secret Santa results: you see only your own pick (and your kids' picks). Nobody else,
--    not even the admin, until 26 December.
-- ============================================================

-- ---------- helper functions ----------
create or replace function public.current_person() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.people where auth_user_id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.people where auth_user_id = auth.uid()), false)
$$;

-- true if p is a child in the same household as the signed-in adult
create or replace function public.is_my_child(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.people c, public.people m
    where c.id = p and c.is_child
      and m.id = public.current_person() and not m.is_child
      and m.household_id is not null and m.household_id = c.household_id
  )
$$;

create or replace function public.can_manage(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p = public.current_person() or public.is_admin() or public.is_my_child(p)
$$;

create or replace function public.brisbane_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Australia/Brisbane')::date
$$;

-- Secret Santa results open to everyone from 26 December of the draw year
create or replace function public.santa_revealed(y int) returns boolean
language sql stable set search_path = '' as $$
  select public.brisbane_today() >= make_date(y, 12, 26)
$$;

-- ---------- stop non-admins editing sensitive columns on people ----------
create or replace function public.people_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and not public.is_admin() then
    if new.is_admin     is distinct from old.is_admin
    or new.auth_user_id is distinct from old.auth_user_id
    or new.household_id is distinct from old.household_id
    or new.spouse_id    is distinct from old.spouse_id
    or new.is_child     is distinct from old.is_child
    or new.active       is distinct from old.active then
      raise exception 'Only the admin can change that';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists people_guard on public.people;
create trigger people_guard before update on public.people
  for each row execute function public.people_guard();

-- ---------- functions the app calls ----------

-- Names for the sign-in screen (the only thing a signed-out visitor can see)
create or replace function public.login_roster(p_side text)
returns table (id uuid, full_name text, color text, photo_url text, claimed boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.color, p.photo_url, (p.auth_user_id is not null)
  from public.people p
  join public.person_sides s on s.person_id = p.id
  where s.side_id = p_side and p.active and not p.is_child
  order by p.full_name
$$;

-- First sign-in: link the new login to the person they picked
create or replace function public.claim_person(p_person uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.people set auth_user_id = auth.uid()
   where id = p_person and auth_user_id is null
     and not exists (select 1 from public.people where auth_user_id = auth.uid());
  if not found then raise exception 'That profile is already set up'; end if;
end $$;

-- Admin: set someone's PIN (forgotten PIN). Same recipe the app uses to build the password.
create or replace function public.admin_set_pin(p_person uuid, p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must be 4 digits'; end if;
  select auth_user_id into uid from public.people where id = p_person;
  if uid is null then return; end if;   -- never signed up: they just set a PIN themselves
  update auth.users
     set encrypted_password = extensions.crypt('wgi-' || p_pin || '-' || left(p_person::text, 8), extensions.gen_salt('bf'))
   where id = uid;
end $$;

-- Gifts whose occasion has passed drop off the active wishlist (kept in history)
create or replace function public.archive_given_items() returns void
language sql security definer set search_path = '' as $$
  update public.wishlist_items set archived_at = now()
   where archived_at is null
     and id in (select item_id from public.claims
                 where state = 'bought' and item_id is not null
                   and occasion_date < public.brisbane_today());
$$;

-- ---------- row-level security ----------
alter table public.sides           enable row level security;
alter table public.households      enable row level security;
alter table public.people          enable row level security;
alter table public.person_sides    enable row level security;
alter table public.wishlist_items  enable row level security;
alter table public.claims          enable row level security;
alter table public.chip_ins        enable row level security;
alter table public.chip_in_pledges enable row level security;
alter table public.santa_draws     enable row level security;
alter table public.santa_pairs     enable row level security;
alter table public.email_queue     enable row level security;   -- no policies = no app access

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy sides_read   on public.sides for select to anon, authenticated using (true);
create policy sides_admin  on public.sides for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy hh_read      on public.households for select to authenticated using (true);
create policy hh_admin     on public.households for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy people_read   on public.people for select to authenticated using (true);
create policy people_add    on public.people for insert to authenticated with check (public.is_admin());
create policy people_edit   on public.people for update to authenticated using (public.can_manage(id)) with check (public.can_manage(id));
create policy people_remove on public.people for delete to authenticated using (public.is_admin());

create policy ps_read      on public.person_sides for select to authenticated using (true);
create policy ps_admin     on public.person_sides for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy wl_read      on public.wishlist_items for select to authenticated using (true);
create policy wl_add       on public.wishlist_items for insert to authenticated with check (public.can_manage(person_id));
create policy wl_edit      on public.wishlist_items for update to authenticated using (public.can_manage(person_id)) with check (public.can_manage(person_id));
create policy wl_remove    on public.wishlist_items for delete to authenticated using (public.can_manage(person_id));

-- claims: the recipient can never see claims made for them
create policy claims_read  on public.claims for select to authenticated using (recipient_id is distinct from public.current_person());
create policy claims_add   on public.claims for insert to authenticated with check (claimer_id = public.current_person() and recipient_id <> public.current_person());
create policy claims_edit  on public.claims for update to authenticated using (claimer_id = public.current_person()) with check (claimer_id = public.current_person() and recipient_id <> public.current_person());
create policy claims_remove on public.claims for delete to authenticated using (claimer_id = public.current_person());

create policy chip_read    on public.chip_ins for select to authenticated using (recipient_id is distinct from public.current_person());
create policy chip_add     on public.chip_ins for insert to authenticated with check (organiser_id = public.current_person() and recipient_id <> public.current_person());
create policy chip_edit    on public.chip_ins for update to authenticated using (organiser_id = public.current_person()) with check (organiser_id = public.current_person());
create policy chip_remove  on public.chip_ins for delete to authenticated using (organiser_id = public.current_person());
create policy pledge_read  on public.chip_in_pledges for select to authenticated using (exists (select 1 from public.chip_ins c where c.id = chip_in_id));
create policy pledge_add   on public.chip_in_pledges for insert to authenticated with check (person_id = public.current_person());
create policy pledge_edit  on public.chip_in_pledges for update to authenticated using (person_id = public.current_person()) with check (person_id = public.current_person());
create policy pledge_remove on public.chip_in_pledges for delete to authenticated using (person_id = public.current_person());

-- Secret Santa: your own pick (and your kids'), or everything once revealed. No admin exception, on purpose.
create policy santa_draws_read on public.santa_draws for select to authenticated using (true);
create policy santa_pairs_read on public.santa_pairs for select to authenticated using (
  giver_id = public.current_person()
  or public.is_my_child(giver_id)
  or exists (select 1 from public.santa_draws d where d.id = draw_id and public.santa_revealed(d.year))
);

-- ---------- table access ----------
-- (We switched off "automatically expose new tables" in Supabase, so access is granted here, table by table.)
grant usage on schema public to anon, authenticated, service_role;
grant select on public.sides to anon, authenticated;
grant select, insert, update, delete on public.households, public.people, public.person_sides,
      public.wishlist_items, public.claims, public.chip_ins, public.chip_in_pledges to authenticated;
grant insert, update, delete on public.sides to authenticated;
grant select on public.santa_draws, public.santa_pairs to authenticated;
grant all on all tables in schema public to service_role;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.login_roster(text)         to anon, authenticated;
grant execute on function public.current_person()           to authenticated, service_role;
grant execute on function public.is_admin()                 to authenticated, service_role;
grant execute on function public.is_my_child(uuid)          to authenticated, service_role;
grant execute on function public.can_manage(uuid)           to authenticated, service_role;
grant execute on function public.brisbane_today()           to authenticated, service_role;
grant execute on function public.santa_revealed(int)        to authenticated, service_role;
grant execute on function public.claim_person(uuid)         to authenticated;
grant execute on function public.admin_set_pin(uuid, text)  to authenticated;
grant execute on function public.archive_given_items()      to authenticated, service_role;

-- ---------- photo storage (wishlist photos + profile faces) ----------
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true), ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists wgi_photos_add    on storage.objects;
drop policy if exists wgi_photos_edit   on storage.objects;
drop policy if exists wgi_photos_remove on storage.objects;
create policy wgi_photos_add    on storage.objects for insert to authenticated
  with check (bucket_id in ('item-photos', 'avatars'));
create policy wgi_photos_edit   on storage.objects for update to authenticated
  using (bucket_id in ('item-photos', 'avatars') and owner = auth.uid());
create policy wgi_photos_remove on storage.objects for delete to authenticated
  using (bucket_id in ('item-photos', 'avatars') and owner = auth.uid());
