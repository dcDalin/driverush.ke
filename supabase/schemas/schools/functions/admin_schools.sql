-- ===================================================
-- FUNCTIONS: DriveRush staff create and run schools
-- ===================================================

-- The school's owner, other than p_new_owner, steps down: kept as an admin of
-- every open branch when p_keep is true (and the school has one), otherwise
-- removed.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.set_school_owner, private.match_pending_invites
create or replace function private.step_down_owner(p_school_id uuid, p_new_owner uuid, p_keep boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  select m.id into v_member_id from public.school_members as m
   where m.school_id = p_school_id and m.role = 'owner' and m.user_id <> p_new_owner;
  if v_member_id is null then
    return;
  end if;
  if p_keep and exists (select 1 from public.school_branches as b
                         where b.school_id = p_school_id and b.is_active) then
    update public.school_members set role = 'admin' where id = v_member_id;
    insert into public.school_member_branches (member_id, branch_id, school_id)
    select v_member_id, b.id, b.school_id
      from public.school_branches as b
     where b.school_id = p_school_id and b.is_active
    on conflict do nothing;
  else
    delete from public.school_members where id = v_member_id;
  end if;
end;
$$;

-- Makes the account with this email the school's owner (replacing the
-- current one), or, if no confirmed account has it yet, leaves an owner
-- invite that match_pending_invites takes up on confirmation.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: admin_create_school, admin_transfer_school_owner
create or replace function private.set_school_owner(
  p_school_id uuid,
  p_email extensions.citext,
  p_actor uuid,
  p_keep_previous boolean default false
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := private.confirmed_user_id(p_email);
begin
  update public.school_member_invites
     set status = 'cancelled', closed_at = now()
   where school_id = p_school_id and role = 'owner' and status = 'pending';

  if v_user_id is null then
    -- An earlier admin invite for the same email gives way to the owner one.
    update public.school_member_invites
       set status = 'cancelled', closed_at = now()
     where school_id = p_school_id and email = p_email and status = 'pending';
    insert into public.school_member_invites (school_id, email, role, invited_by, keep_previous_owner)
    values (p_school_id, p_email, 'owner', p_actor, coalesce(p_keep_previous, false));
    return 'invited';
  end if;

  perform private.step_down_owner(p_school_id, v_user_id, coalesce(p_keep_previous, false));

  insert into public.school_members (school_id, user_id, role, added_by)
  values (p_school_id, v_user_id, 'owner', p_actor)
  on conflict (school_id, user_id) do update set role = 'owner';

  -- The owner sees every branch; branch ties from an admin past are dropped.
  delete from public.school_member_branches as mb
   using public.school_members as m
   where mb.member_id = m.id and m.school_id = p_school_id and m.user_id = v_user_id;
  return 'added';
end;
$$;

-- With an owner's email the school is active at once (the owner is added,
-- or invited until they sign up). Without one it is created in `setup`:
-- hidden from learners, the board and the site while staff prepare its
-- profile, branches and livery, until admin_hand_over_school.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_create_school(
  p_name text,
  p_slug text,
  p_owner_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.schools (name, slug, created_by, status)
  values (
    btrim(p_name),
    lower(btrim(p_slug)),
    auth.uid(),
    case when nullif(btrim(coalesce(p_owner_email, '')), '') is null
         then 'setup'::public.school_status else 'active'::public.school_status end
  )
  returning id into v_school_id;

  if nullif(btrim(coalesce(p_owner_email, '')), '') is not null then
    perform private.set_school_owner(v_school_id, lower(btrim(p_owner_email))::extensions.citext, auth.uid());
  end if;
  return v_school_id;
end;
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_set_school_status(p_school_id uuid, p_status public.school_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- `setup` is only where a school starts; a live school never goes back.
  if p_status = 'setup' then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  update public.schools set status = p_status where id = p_school_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Returns 'added' (the account exists and is now owner) or 'invited'.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_transfer_school_owner(p_school_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return private.set_school_owner(p_school_id, lower(btrim(p_email))::extensions.citext, auth.uid());
end;
$$;

-- Staff hand a school they have set up to its owner: the email becomes the
-- owner (added, or invited until they sign up) and a `setup` school goes
-- live. Returns 'added' or 'invited'. For an active school it is a plain
-- change of owner.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_hand_over_school(
  p_school_id uuid,
  p_owner_email text,
  p_keep_previous_owner boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.school_status;
  v_result text;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select status into v_status from public.schools where id = p_school_id for update;
  if v_status is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_status = 'archived' then
    raise exception 'school_inactive' using errcode = 'P0001';
  end if;
  v_result := private.set_school_owner(
    p_school_id, lower(btrim(p_owner_email))::extensions.citext, auth.uid(), p_keep_previous_owner
  );
  if v_status = 'setup' then
    update public.schools set status = 'active' where id = p_school_id;
  end if;
  return v_result;
end;
$$;

-- One page of schools for the console: search by name, slug or owner email,
-- filter by status, livery and sponsorship, newest first. `total` is the
-- count of every match, on every row, for the pager.
--
-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (private.is_staff)
-- Callers: DriveRush console (session)
create or replace function private.admin_list_schools(
  p_search text,
  p_status text,
  p_livery text,
  p_sponsoring text,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  name text,
  slug text,
  status public.school_status,
  created_at timestamptz,
  owner_email text,
  invited_owner_email text,
  admins integer,
  branches integer,
  students integer,
  livery text,
  drafts integer,
  sponsoring boolean,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  with base as (
    select
      s.id, s.name, s.slug, s.status, s.created_at,
      (select u.email::text from public.school_members as m
         join auth.users as u on u.id = m.user_id
        where m.school_id = s.id and m.role = 'owner' limit 1) as owner_email,
      (select i.email::text from public.school_member_invites as i
        where i.school_id = s.id and i.role = 'owner' and i.status = 'pending'
        order by i.created_at desc limit 1) as invited_owner_email,
      (select count(*)::integer from public.school_members as m
        where m.school_id = s.id and m.role = 'admin') as admins,
      (select count(*)::integer from public.school_branches as b
        where b.school_id = s.id) as branches,
      (select count(*)::integer from public.school_student_links as l
        where l.school_id = s.id and l.status = 'active' and l.ends_at > now()) as students,
      case
        when exists (select 1 from public.school_liveries as v where v.school_id = s.id and v.status = 'live') then 'live'
        when exists (select 1 from public.school_liveries as v where v.school_id = s.id and v.status = 'draft') then 'draft'
        else 'none'
      end as livery,
      (select count(*)::integer from public.school_liveries as v
        where v.school_id = s.id and v.status = 'draft') as drafts,
      exists (
        select 1 from public.school_sponsorships as sp
         where sp.school_id = s.id
           and sp.starts_on <= private.kenya_today()
           and (sp.ends_on is null or sp.ends_on >= private.kenya_today())
      ) as sponsoring
    from public.schools as s
  ),
  matched as (
    select * from base as b
     where (v_search is null
            or b.name ilike '%' || v_search || '%'
            or b.slug ilike '%' || v_search || '%'
            or coalesce(b.owner_email, '') ilike '%' || v_search || '%'
            or coalesce(b.invited_owner_email, '') ilike '%' || v_search || '%')
       and (coalesce(p_status, 'any') = 'any' or b.status::text = p_status)
       and (coalesce(p_livery, 'any') = 'any' or b.livery = p_livery)
       and (coalesce(p_sponsoring, 'any') = 'any'
            or (p_sponsoring = 'yes' and b.sponsoring)
            or (p_sponsoring = 'no' and not b.sponsoring))
  )
  select m.id, m.name, m.slug, m.status, m.created_at, m.owner_email, m.invited_owner_email,
         m.admins, m.branches, m.students, m.livery, m.drafts, m.sponsoring,
         count(*) over () as total
    from matched as m
   order by m.created_at desc, m.name
   limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_create_school(
  p_name text,
  p_slug text,
  p_owner_email text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.admin_create_school(p_name, p_slug, p_owner_email);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_set_school_status(p_school_id uuid, p_status public.school_status)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_set_school_status(p_school_id, p_status);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_transfer_school_owner(p_school_id uuid, p_email text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.admin_transfer_school_owner(p_school_id, p_email);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_hand_over_school(
  p_school_id uuid,
  p_owner_email text,
  p_keep_previous_owner boolean default false
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.admin_hand_over_school(p_school_id, p_owner_email, p_keep_previous_owner);
$$;

-- Access:  authenticated (DriveRush su or admin)
-- Guard:   admin (the private body checks private.is_staff)
-- Callers: DriveRush console (session)
create or replace function public.admin_list_schools(
  p_search text,
  p_status text,
  p_livery text,
  p_sponsoring text,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  name text,
  slug text,
  status public.school_status,
  created_at timestamptz,
  owner_email text,
  invited_owner_email text,
  admins integer,
  branches integer,
  students integer,
  livery text,
  drafts integer,
  sponsoring boolean,
  total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_schools(p_search, p_status, p_livery, p_sponsoring, p_limit, p_offset);
$$;

revoke all on function private.admin_hand_over_school(uuid, text, boolean) from public;
revoke all on function private.admin_list_schools(text, text, text, text, integer, integer) from public;
revoke all on function public.admin_hand_over_school(uuid, text, boolean) from public;
revoke all on function public.admin_list_schools(text, text, text, text, integer, integer) from public;
grant execute on function private.admin_hand_over_school(uuid, text, boolean) to service_role;
grant execute on function private.admin_list_schools(text, text, text, text, integer, integer) to service_role;
grant execute on function public.admin_hand_over_school(uuid, text, boolean) to service_role;
grant execute on function public.admin_list_schools(text, text, text, text, integer, integer) to service_role;
comment on function private.admin_hand_over_school(uuid, text, boolean) is
  'DriveRush staff: makes an email the school owner (added or invited), keeping the old owner as an admin if asked, and puts a setup school live.';
comment on function public.admin_hand_over_school(uuid, text, boolean) is
  'DriveRush staff: makes an email the school owner (added or invited), keeping the old owner as an admin if asked, and puts a setup school live.';
comment on function private.admin_list_schools(text, text, text, text, integer, integer) is
  'DriveRush staff: one page of schools (search, status, livery and sponsorship filters) with the total count.';
comment on function public.admin_list_schools(text, text, text, text, integer, integer) is
  'DriveRush staff: one page of schools (search, status, livery and sponsorship filters) with the total count.';

revoke all on function private.step_down_owner(uuid, uuid, boolean) from public;
revoke all on function private.set_school_owner(uuid, extensions.citext, uuid, boolean) from public;
revoke all on function private.admin_create_school(text, text, text) from public;
revoke all on function private.admin_set_school_status(uuid, public.school_status) from public;
revoke all on function private.admin_transfer_school_owner(uuid, text) from public;
revoke all on function public.admin_create_school(text, text, text) from public;
revoke all on function public.admin_set_school_status(uuid, public.school_status) from public;
revoke all on function public.admin_transfer_school_owner(uuid, text) from public;
grant execute on function private.step_down_owner(uuid, uuid, boolean) to service_role;
grant execute on function private.set_school_owner(uuid, extensions.citext, uuid, boolean) to service_role;
grant execute on function private.admin_create_school(text, text, text) to service_role;
grant execute on function private.admin_set_school_status(uuid, public.school_status) to service_role;
grant execute on function private.admin_transfer_school_owner(uuid, text) to service_role;
grant execute on function public.admin_create_school(text, text, text) to service_role;
grant execute on function public.admin_set_school_status(uuid, public.school_status) to service_role;
grant execute on function public.admin_transfer_school_owner(uuid, text) to service_role;

comment on function private.step_down_owner(uuid, uuid, boolean) is
  'The school''s old owner steps down: kept as an admin of every open branch, or removed.';
comment on function private.set_school_owner(uuid, extensions.citext, uuid, boolean) is
  'Makes an email the school owner now (confirmed account) or by invite; replaces the current owner.';
comment on function private.admin_create_school(text, text, text) is
  'DriveRush staff: creates a school and sets its owner by email.';
comment on function private.admin_set_school_status(uuid, public.school_status) is
  'DriveRush staff: sets a school active, suspended or archived.';
comment on function private.admin_transfer_school_owner(uuid, text) is
  'DriveRush staff: makes another email the school owner. Returns added or invited.';
comment on function public.admin_create_school(text, text, text) is
  'DriveRush staff: creates a school and sets its owner by email.';
comment on function public.admin_set_school_status(uuid, public.school_status) is
  'DriveRush staff: sets a school active, suspended or archived.';
comment on function public.admin_transfer_school_owner(uuid, text) is
  'DriveRush staff: makes another email the school owner. Returns added or invited.';
