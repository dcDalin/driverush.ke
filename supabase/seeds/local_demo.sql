-- ===================================================
-- Local demo data (CLI stacks only)
-- ===================================================
-- Two schools with branches, owners and admins, and learners in each state.
-- Every account's password is `driverush-local-1`. Refuses to do anything
-- unless private.is_local_stack(), so a hosted database never gets it.
--
--   su@driverush.test              DriveRush su
--   admin@driverush.test           DriveRush admin
--   owner@heltz.test               Heltz owner (all branches)
--   cbd.admin@heltz.test           Heltz admin, Nairobi CBD branch
--   westlands.admin@heltz.test     Heltz admin, Westlands branch
--   owner@topgear.test             Top Gear owner
--   amina@learner.test             linked to Heltz, Nairobi CBD
--   brian@learner.test             linked to Heltz, Westlands
--   chebet@learner.test            added by both schools: chooses (2 pending)
--   dan@learner.test               own paid subscription, no school
--   esther@learner.test            free account
--
-- Schools, branches, invites and links are made first; the accounts come
-- last, so their sign-up runs the real matching (match_pending_invites).

create function pg_temp.seed_user(p_email text, p_name text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('driverush-local-1', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('full_name', p_name), now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
          'email', now(), now(), now());
  return v_id;
end;
$$;

do $$
declare
  v_heltz uuid;
  v_topgear uuid;
  v_cbd uuid;
  v_westlands uuid;
  v_thika uuid;
  v_dan uuid;
begin
  if not private.is_local_stack() then
    raise notice 'local_demo.sql: not a CLI stack, nothing seeded';
    return;
  end if;

  insert into public.schools (slug, name, sponsor_id) values ('heltz', 'Heltz Driving School', 'heltz')
  returning id into v_heltz;
  insert into public.schools (slug, name, sponsor_id) values ('topgear', 'Top Gear Driving School', 'topgear')
  returning id into v_topgear;

  insert into public.school_branches (school_id, name, town) values (v_heltz, 'Nairobi CBD', 'Nairobi')
  returning id into v_cbd;
  insert into public.school_branches (school_id, name, town) values (v_heltz, 'Westlands', 'Nairobi')
  returning id into v_westlands;
  insert into public.school_branches (school_id, name, town) values (v_topgear, 'Thika Road', 'Nairobi')
  returning id into v_thika;

  insert into public.school_member_invites (school_id, email, role, branch_ids) values
    (v_heltz, 'owner@heltz.test', 'owner', '{}'),
    (v_heltz, 'cbd.admin@heltz.test', 'admin', array[v_cbd]),
    (v_heltz, 'westlands.admin@heltz.test', 'admin', array[v_westlands]),
    (v_topgear, 'owner@topgear.test', 'owner', '{}');

  insert into public.school_student_links (school_id, branch_id, email) values
    (v_heltz, v_cbd, 'amina@learner.test'),
    (v_heltz, v_westlands, 'brian@learner.test'),
    (v_heltz, v_cbd, 'chebet@learner.test'),
    (v_topgear, v_thika, 'chebet@learner.test');

  perform pg_temp.seed_user('su@driverush.test', 'DriveRush Su');
  perform pg_temp.seed_user('admin@driverush.test', 'DriveRush Admin');
  perform pg_temp.seed_user('owner@heltz.test', 'Heltz Owner');
  perform pg_temp.seed_user('cbd.admin@heltz.test', 'Heltz CBD Admin');
  perform pg_temp.seed_user('westlands.admin@heltz.test', 'Heltz Westlands Admin');
  perform pg_temp.seed_user('owner@topgear.test', 'Top Gear Owner');
  perform pg_temp.seed_user('amina@learner.test', 'Amina Learner');
  perform pg_temp.seed_user('brian@learner.test', 'Brian Learner');
  perform pg_temp.seed_user('chebet@learner.test', 'Chebet Learner');
  v_dan := pg_temp.seed_user('dan@learner.test', 'Dan Learner');
  perform pg_temp.seed_user('esther@learner.test', 'Esther Learner');

  insert into public.user_roles (user_id, role)
  select id, 'driverush_su' from auth.users where email = 'su@driverush.test';
  insert into public.user_roles (user_id, role)
  select id, 'driverush_admin' from auth.users where email = 'admin@driverush.test';

  insert into public.learner_subscriptions (user_id, plan_id, starts_at, ends_at, source)
  select v_dan, p.id, now(), now() + interval '1 month', 'grant'
    from public.plans as p where p.code = 'learner_monthly';

  insert into public.learner_progress (user_id, store, data, version)
  select u.id, 'streak', '{"state": {"days": 3}}'::jsonb, 1
    from auth.users as u where u.email in ('amina@learner.test', 'brian@learner.test');
end;
$$;
