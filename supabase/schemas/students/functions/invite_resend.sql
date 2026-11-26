-- ===================================================
-- FUNCTIONS: invites lapse, and are sent again within limits
-- ===================================================
-- Owner, 2026-11-26. A student's pending link and an owner or admin invite
-- lapse 30 days after they were last sent: they stay pending, but nothing
-- matches, joins or counts them (match_pending_invites, the learner's choice,
-- the 50-admin count, the console). Sending one again renews it for 30 days.
-- Each is sent at most 5 times, at least 10 minutes apart, so a school cannot
-- flood an inbox; after 5, withdraw it and add the person again.

-- Refuses a send that comes too soon or one too many; otherwise nothing.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: school_add_student, school_add_admin, school_resend_student_invite,
--          school_resend_member_invite
create or replace function private.invite_resend(p_last_sent_at timestamptz, p_sent_count integer)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_last_sent_at > now() - interval '10 minutes' then
    raise exception 'resend_too_soon' using errcode = 'P0001';
  end if;
  if p_sent_count >= 5 then
    raise exception 'resend_limit' using errcode = 'P0001';
  end if;
end;
$$;

-- Sends a student's invite again: renews it for 30 days and returns what the
-- email needs. Only a link still waiting.
--
-- Access:  authenticated (school owner, admin of the link's branch, or DriveRush staff)
-- Guard:   admin (private.can_manage_branch on the link's branch)
-- Callers: school dashboard (session)
create or replace function private.school_resend_student_invite(p_link_id uuid)
returns table (email text, branch_name text, school_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.school_student_links;
begin
  select * into v_link from public.school_student_links where id = p_link_id for update;
  if v_link.id is null or not private.can_manage_branch(v_link.branch_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_link.status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  perform private.invite_resend(v_link.last_sent_at, v_link.sent_count);
  update public.school_student_links
     set expires_at = now() + interval '30 days',
         sent_count = sent_count + 1,
         last_sent_at = now()
   where id = p_link_id;
  return query
    select v_link.email::text, b.name, s.name
      from public.school_branches as b
      join public.schools as s on s.id = b.school_id
     where b.id = v_link.branch_id;
end;
$$;

-- Sends an owner or admin invite again: renews it for 30 days and returns
-- what the email needs. A school's owner may re-send admin invites; an owner
-- invite (a hand-over) is DriveRush staff's.
--
-- Access:  authenticated (school owner for admin invites, or DriveRush staff)
-- Guard:   admin (private.can_manage_school; owner invites private.is_staff)
-- Callers: school dashboard (session), console (session)
create or replace function private.school_resend_member_invite(p_invite_id uuid)
returns table (email text, role public.school_role, branch_ids uuid[], school_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.school_member_invites;
begin
  select * into v_invite from public.school_member_invites where id = p_invite_id for update;
  if v_invite.id is null
     or not private.can_manage_school(v_invite.school_id)
     or (v_invite.role = 'owner' and not private.is_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  perform private.invite_resend(v_invite.last_sent_at, v_invite.sent_count);
  -- A lapsed admin invite is not counted in the 50; renewing it must fit.
  if v_invite.role = 'admin' and v_invite.expires_at <= now() then
    perform private.assert_admin_room(v_invite.school_id);
  end if;
  update public.school_member_invites
     set expires_at = now() + interval '30 days',
         sent_count = sent_count + 1,
         last_sent_at = now()
   where id = p_invite_id;
  return query
    select v_invite.email::text, v_invite.role, v_invite.branch_ids, s.name
      from public.schools as s
     where s.id = v_invite.school_id;
end;
$$;

-- Access:  authenticated (school owner, admin of the link's branch, or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_branch)
-- Callers: school dashboard (session)
create or replace function public.school_resend_student_invite(p_link_id uuid)
returns table (email text, branch_name text, school_name text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.school_resend_student_invite(p_link_id);
$$;

-- Access:  authenticated (school owner for admin invites, or DriveRush staff)
-- Guard:   admin (the private body checks private.can_manage_school)
-- Callers: school dashboard (session), console (session)
create or replace function public.school_resend_member_invite(p_invite_id uuid)
returns table (email text, role public.school_role, branch_ids uuid[], school_name text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.school_resend_member_invite(p_invite_id);
$$;

revoke all on function private.invite_resend(timestamptz, integer) from public;
revoke all on function private.school_resend_student_invite(uuid) from public;
revoke all on function public.school_resend_student_invite(uuid) from public;
revoke all on function private.school_resend_member_invite(uuid) from public;
revoke all on function public.school_resend_member_invite(uuid) from public;
grant execute on function private.invite_resend(timestamptz, integer) to service_role;
grant execute on function private.school_resend_student_invite(uuid) to service_role;
grant execute on function public.school_resend_student_invite(uuid) to service_role;
grant execute on function private.school_resend_member_invite(uuid) to service_role;
grant execute on function public.school_resend_member_invite(uuid) to service_role;

comment on function private.invite_resend(timestamptz, integer) is
  'Refuses an invite send under 10 minutes after the last one (resend_too_soon) or past 5 (resend_limit).';
comment on function private.school_resend_student_invite(uuid) is
  'School team: sends a waiting student invite again (renewed 30 days), within the limits.';
comment on function public.school_resend_student_invite(uuid) is
  'School team: sends a waiting student invite again (renewed 30 days), within the limits.';
comment on function private.school_resend_member_invite(uuid) is
  'Owner (admin invites) or staff: sends a waiting member invite again (renewed 30 days), within the limits.';
comment on function public.school_resend_member_invite(uuid) is
  'Owner (admin invites) or staff: sends a waiting member invite again (renewed 30 days), within the limits.';
