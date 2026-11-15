-- Example only. The real seed (03_seed.private.sql) holds real names and is NOT in this repo.
insert into public.sides (id, name, sort) values ('hm', 'Side A', 1), ('hb', 'Side B', 2) on conflict (id) do nothing;
insert into public.households (id, name) values ('b0000000-0000-4000-8000-000000000001', 'Example household') on conflict (id) do nothing;
insert into public.people (id, full_name, household_id, is_child, is_admin, color) values
  ('a0000000-0000-4000-8000-000000000001', 'Alex Example', 'b0000000-0000-4000-8000-000000000001', false, true, 'blue')
on conflict (id) do nothing;
insert into public.person_sides (person_id, side_id) values ('a0000000-0000-4000-8000-000000000001', 'hm') on conflict do nothing;
