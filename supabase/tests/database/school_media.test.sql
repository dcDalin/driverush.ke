-- ===================================================
-- pgTAP: school profiles, liveries, sponsorships and the school-media bucket
-- ===================================================
-- The bucket is public, takes raster images only, and no client may list or
-- write it. board_schools() hands anyone the public fields of active schools
-- and only live liveries. Media paths stay inside their own school's folder.
--
-- Everything runs in one rolled-back transaction.
-- ===================================================
begin;

select plan(43);

create temp table w as select tests.make_world() as j;
create function pg_temp.w(k text) returns text language sql as $$ select j ->> k from w $$;
create function pg_temp.p(school text, kind text, n int) returns text language sql as $$
  select pg_temp.w(school) || '/' || kind || '/' || lpad(to_hex(n), 16, '0') || '.webp'
$$;
create function pg_temp.school(slug text) returns jsonb language sql as $$
  select e from jsonb_array_elements(public.board_schools()) as e where e ->> 'slug' = slug
$$;

-- ── The bucket ─────────────────────────────────────────────────────────
select results_eq(
  $$ select id, public, file_size_limit::text, allowed_mime_types::text
       from storage.buckets where id = 'school-media' $$,
  $$ values ('school-media', true, '5242880', '{image/webp,image/png,image/jpeg}') $$,
  'school-media is public, 5 MiB, raster images only (no SVG)'
);
select is(
  (select string_agg(format('%s %s %s', p.policyname, p.cmd, array_to_string(p.roles, ',')), '; ' order by p.policyname::text)
     from pg_policies as p
    where p.schemaname = 'storage' and p.tablename = 'objects'
      and (coalesce(p.qual, '') || coalesce(p.with_check, '')) like '%school-media%'),
  'school-media: staff delete DELETE authenticated; school-media: staff list SELECT authenticated; '
    || 'school-media: staff replace UPDATE authenticated; school-media: staff upload INSERT authenticated',
  'school-media: only staff policies (list, upload, replace, delete); files are read by public URL'
);
select is(
  tests.sqlstate_as(pg_temp.w('owner_a'), format(
    $$insert into storage.objects (bucket_id, name) values ('school-media', %L)$$,
    pg_temp.p('school_a', 'logo', 1))),
  '42501',
  'a school owner cannot write into the bucket directly'
);
select is(
  tests.sqlstate_as('anon', format(
    $$insert into storage.objects (bucket_id, name) values ('school-media', %L)$$,
    pg_temp.p('school_a', 'logo', 1))),
  '42501',
  'nor can a guest'
);
select is(
  tests.sqlstate_as('otp:' || pg_temp.w('staff'), format(
    $$insert into storage.objects (bucket_id, name) values ('school-media', %L)$$,
    pg_temp.p('school_a', 'livery', 1))),
  '42501',
  'nor staff on an emailed-code session'
);
select is(
  tests.sqlstate_as(pg_temp.w('staff'), format(
    $$insert into storage.objects (bucket_id, name) values ('school-media', %L)$$,
    pg_temp.p('school_a', 'livery', 1))),
  'ok',
  'staff on a password session upload'
);
select is(
  tests.value_as('anon', $$select count(*) from storage.objects where bucket_id = 'school-media'$$),
  '0',
  'a guest cannot list the bucket'
);
select is(
  tests.value_as(pg_temp.w('owner_a'), $$select count(*) from storage.objects where bucket_id = 'school-media'$$),
  '0',
  'nor can a school owner'
);

-- ── Paths stay in their school ─────────────────────────────────────────
select throws_ok(
  format($$insert into public.school_profiles (school_id, logo) values (%L, %L)$$,
    pg_temp.w('school_a'),
    jsonb_build_object('path', pg_temp.p('school_b', 'logo', 1), 'width', 10, 'height', 10)),
  '23514', null,
  'a profile cannot point at another school''s files'
);
select throws_ok(
  format($$insert into public.school_profiles (school_id, socials) values (%L, '{"facebook": "http://x.test"}')$$, pg_temp.w('school_a')),
  '23514', null,
  'social links must be https'
);

-- ── Profiles ───────────────────────────────────────────────────────────
select tests.run_as(pg_temp.w('owner_a'), format(
  $$select public.school_update_profile(%L, ' Learn with us ', null, '0712 345 678', null,
    'Hello@School-A.test', 'https://school-a.test', '{"instagram": "https://instagram.com/a"}', '#F4A20C', '#1D2FC2')::text$$,
  pg_temp.w('school_a')));
select is(
  (select row(tagline, email::text, brand_paint) from public.school_profiles where school_id = pg_temp.w('school_a')::uuid)::text,
  '("Learn with us",hello@school-a.test,#f4a20c)',
  'the owner''s profile is trimmed, lower-cased and saved'
);
select is(
  public.school_set_logo(pg_temp.w('school_a')::uuid, 'logo',
    jsonb_build_object('path', pg_temp.p('school_a', 'logo', 1), 'width', 1024, 'height', 401), null),
  null,
  'the server records a first logo (nothing to remove)'
);
select is(
  public.school_set_logo(pg_temp.w('school_a')::uuid, 'logo',
    jsonb_build_object('path', pg_temp.p('school_a', 'logo', 2), 'width', 1024, 'height', 401), null),
  pg_temp.p('school_a', 'logo', 1),
  'a new logo returns the old path, for the server to delete'
);

-- ── Liveries ───────────────────────────────────────────────────────────
create function pg_temp.livery(school text, n int) returns uuid language sql as $$
  insert into public.school_liveries (school_id, label, base_color, rail, paint, marks)
  values (pg_temp.w(school)::uuid, 'v' || n, '#ffffff', '{"gold": "#f4a20c", "red": "#e3271b"}',
          jsonb_build_object('saloon', jsonb_build_object('hi', pg_temp.p(school, 'livery', n * 10 + 1), 'lo', pg_temp.p(school, 'livery', n * 10 + 2))),
          jsonb_build_object('full', pg_temp.p(school, 'livery', n * 10 + 3), 'mono', pg_temp.p(school, 'livery', n * 10 + 4)))
  returning id
$$;
create temp table liv as select pg_temp.livery('school_a', 1) as v1, pg_temp.livery('school_a', 2) as v2;

select is(pg_temp.school((select slug from public.schools where id = pg_temp.w('school_a')::uuid)) -> 'livery', 'null'::jsonb,
  'a draft never reaches board_schools()');
select is(pg_temp.school((select slug from public.schools where id = pg_temp.w('school_b')::uuid)), null,
  'a school with no profile and no live livery is not listed');

select tests.run_as(pg_temp.w('staff'), format('select public.admin_publish_livery(%L)::text', (select v1 from liv)));
select is(pg_temp.school((select slug from public.schools where id = pg_temp.w('school_a')::uuid)) #>> '{livery,id}', (select v1::text from liv),
  'a published livery is the school''s live one');

select tests.run_as(pg_temp.w('staff'), format('select public.admin_publish_livery(%L)::text', (select v2 from liv)));
select results_eq(
  $$ select status::text from public.school_liveries where id in ((select v1 from liv), (select v2 from liv)) order by label $$,
  $$ values ('retired'), ('live') $$,
  'publishing another retires the one before'
);
select is(
  tests.value_as(pg_temp.w('staff'), format('select public.admin_livery_draft_get(%L) ->> ''slug''', (select v1 from liv))),
  (select slug from public.schools where id = pg_temp.w('school_a')::uuid),
  'staff preview any livery in the manifest''s shape'
);
-- ── Who reads and writes livery rows ───────────────────────────────────
select is(
  tests.value_as('anon', format('select string_agg(status::text, '','' order by status) from public.school_liveries where school_id = %L', pg_temp.w('school_a'))),
  'live',
  'a guest reads the live livery, not the retired one'
);
select is(
  tests.value_as(pg_temp.w('owner_a'), format('select string_agg(status::text, '','' order by status) from public.school_liveries where school_id = %L', pg_temp.w('school_a'))),
  'live',
  'a school owner reads only the live one too'
);
select is(
  tests.value_as(pg_temp.w('staff'), format('select count(*) from public.school_liveries where school_id = %L', pg_temp.w('school_a'))),
  '2',
  'staff read every livery'
);
select is(
  tests.sqlstate_as('anon', 'select created_by from public.school_liveries limit 1'),
  '42501',
  'nobody reads who made a livery'
);
select is(
  tests.sqlstate_as(pg_temp.w('owner_a'), format(
    $$insert into public.school_liveries (school_id, label, base_color, rail, paint, marks)
      select school_id, 'mine', base_color, rail, paint, marks from public.school_liveries where id = %L$$,
    (select v2 from liv))),
  '42501',
  'a school owner cannot add a livery'
);
select is(
  tests.value_as(pg_temp.w('owner_a'), format(
    $$with u as (update public.school_liveries set label = 'hacked' where id = %L returning 1) select count(*) from u$$,
    (select v2 from liv))),
  '0',
  'a school owner cannot change one (no row matches)'
);
select is(
  tests.value_as(pg_temp.w('owner_a'), format(
    $$with d as (delete from public.school_liveries where id = %L returning 1) select count(*) from d$$,
    (select v2 from liv))),
  '0',
  'nor delete one'
);
select is(
  tests.sqlstate_as('anon', format($$update public.school_liveries set label = 'x' where id = %L$$, (select v2 from liv))),
  '42501',
  'a guest cannot write at all'
);
select is(
  tests.sqlstate_as('otp:' || pg_temp.w('staff'), format(
    $$insert into public.school_liveries (school_id, label, base_color, rail, paint, marks)
      select school_id, 'otp', base_color, rail, paint, marks from public.school_liveries where id = %L$$,
    (select v2 from liv))),
  '42501',
  'staff on an emailed-code session cannot add one'
);
select is(
  tests.value_as(pg_temp.w('staff'), format(
    $$with i as (insert into public.school_liveries (school_id, label, base_color, rail, paint, marks)
      select school_id, 'staff draft', base_color, rail, paint, marks from public.school_liveries where id = %L
      returning status) select string_agg(status::text, ',') from i$$,
    (select v1 from liv))),
  'draft',
  'staff add a livery, always as a draft'
);
select is(
  tests.value_as(pg_temp.w('staff'), format(
    $$with u as (update public.school_liveries set label = 'renamed' where id = %L returning 1) select count(*) from u$$,
    (select v2 from liv))),
  '1',
  'staff change a livery''s content'
);
select is(
  tests.sqlstate_as(pg_temp.w('staff'), format($$update public.school_liveries set status = 'retired' where id = %L$$, (select v2 from liv))),
  '42501',
  'but not its status: going live or retiring is admin_publish_livery / admin_retire_livery'
);
select is(
  tests.value_as(pg_temp.w('staff'), format(
    $$with d as (delete from public.school_liveries where id = %L returning 1) select count(*) from d$$,
    (select v2 from liv))),
  '0',
  'staff cannot delete the live livery'
);
select is(
  tests.value_as(pg_temp.w('staff'), format(
    $$with d as (delete from public.school_liveries where id = %L returning 1) select count(*) from d$$,
    (select v1 from liv))),
  '1',
  'staff delete one that is not live'
);

-- ── Sponsorships ───────────────────────────────────────────────────────
select is(pg_temp.school((select slug from public.schools where id = pg_temp.w('school_a')::uuid)) -> 'sponsoring', 'false'::jsonb,
  'no sponsorship: the school is listed but does not rotate');
create temp table sp as select tests.run_as(pg_temp.w('staff'),
  format($$select public.admin_set_sponsorship(%L, current_date - 1, null, 'Q1')::text$$, pg_temp.w('school_a')))::uuid as id;
select is(pg_temp.school((select slug from public.schools where id = pg_temp.w('school_a')::uuid)) -> 'sponsoring', 'true'::jsonb,
  'a current sponsorship makes it rotate');
select tests.run_as(pg_temp.w('staff'), format('select public.admin_end_sponsorship(%L)::text', (select id from sp)));
select is((select ends_on from public.school_sponsorships where id = (select id from sp)), private.kenya_today(),
  'ending a sponsorship sets today''s Kenyan date');

-- ── Profiles are public while the school is active ─────────────────────
select is(
  tests.value_as('anon', format('select tagline from public.school_profiles where school_id = %L', pg_temp.w('school_a'))),
  'Learn with us',
  'a guest reads an active school''s profile'
);
select is(
  tests.sqlstate_as('anon', 'select updated_by from public.school_profiles limit 1'),
  '42501',
  'but not who edited it'
);
select is(
  tests.sqlstate_as(pg_temp.w('owner_a'), format($$update public.school_profiles set tagline = 'x' where school_id = %L$$, pg_temp.w('school_a'))),
  '42501',
  'the owner edits it only through school_update_profile (no direct write)'
);
update public.schools set status = 'suspended' where id = pg_temp.w('school_a')::uuid;
select is(
  tests.value_as('anon', format('select count(*) from public.school_profiles where school_id = %L', pg_temp.w('school_a'))),
  '0',
  'a suspended school''s profile is hidden from guests'
);
select is(
  tests.value_as('anon', format('select count(*) from public.school_liveries where school_id = %L', pg_temp.w('school_a'))),
  '0',
  'and so is its livery'
);
select is(
  tests.value_as(pg_temp.w('owner_a'), format('select count(*) from public.school_profiles where school_id = %L', pg_temp.w('school_a'))),
  '1',
  'its owner still reads the profile'
);
update public.schools set status = 'active' where id = pg_temp.w('school_a')::uuid;

-- ── What guests get ────────────────────────────────────────────────────
select is(
  tests.value_as('anon', format($$select e -> 'profile' ->> 'tagline' from jsonb_array_elements(public.board_schools()) as e where e ->> 'name' = 'Test School A' limit 1$$)),
  'Learn with us',
  'guests read the public profile through board_schools()'
);
select is(
  tests.value_as('anon', $$select count(*) from jsonb_array_elements(public.board_schools()) as e where e ? 'created_by' or e -> 'livery' ? 'created_by'$$),
  '0',
  'and never who made what'
);

select * from finish();
rollback;
