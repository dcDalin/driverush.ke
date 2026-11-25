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

select plan(19);

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
select is_empty(
  $$ select policyname from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and coalesce(qual, '') || coalesce(with_check, '') like '%school-media%' $$,
  'no storage policy names school-media: clients can neither list nor write it'
);
select is(
  tests.sqlstate_as(pg_temp.w('owner_a'), format(
    $$insert into storage.objects (bucket_id, name) values ('school-media', %L)$$,
    pg_temp.p('school_a', 'logo', 1))),
  '42501',
  'a school owner cannot write into the bucket directly'
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
select is(
  tests.value_as(pg_temp.w('owner_a'), 'select count(*) from public.school_liveries'),
  '0',
  'a school owner reads no livery rows (only staff do)'
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
