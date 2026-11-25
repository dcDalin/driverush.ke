-- ===================================================
-- FUNCTIONS: starting and ending a school-learner link
-- ===================================================
-- Every status change of school_student_links goes through these, so the
-- one-active-link rule is applied in one place. A link is free (owner,
-- 2026-11-25): the school car and the school's view of the learner's
-- progress. A pass (learner_subscriptions) is what unlocks the course; a pass
-- bought through the school keeps the link open for as long as it runs
-- (private.settle_payment).

-- The confirmed account with this email, if any. Only a confirmed address
-- matches, so nobody claims a school link by typing someone else's email.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: school_add_student, school_add_admin, private.set_school_owner
create or replace function private.confirmed_user_id(p_email extensions.citext)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users as u
   where u.email::extensions.citext = p_email
     and u.email_confirmed_at is not null
   limit 1;
$$;

-- Closes active links whose month is over (status ended, reason expired) for
-- this learner or this email, before another link may start.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.activate_link, private.match_pending_invites, school_add_student, learner_accept_school_link
create or replace function private.close_expired_links(p_user_id uuid, p_email extensions.citext)
returns void
language sql
set search_path = ''
as $$
  update public.school_student_links
     set status = 'ended', end_reason = 'expired', ended_at = ends_at
   where status = 'active'
     and ends_at <= now()
     and (user_id = p_user_id or email = p_email);
$$;

-- The learner's current link: active and inside its month.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.match_pending_invites, school_add_student, learner_accept_school_link, my_entitlement, school_student_progress
create or replace function private.current_link_id(p_user_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select l.id from public.school_student_links as l
   where l.user_id = p_user_id and l.status = 'active' and l.ends_at > now()
   limit 1;
$$;

-- Starts a pending link now for this learner, a month long.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.match_pending_invites, school_add_student, learner_accept_school_link, settle_payment
create or replace function private.activate_link(p_link_id uuid, p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.close_expired_links(p_user_id, null);

  update public.school_student_links
     set status = 'active',
         user_id = p_user_id,
         starts_at = now(),
         ends_at = now() + interval '1 month'
   where id = p_link_id and status = 'pending';

  if not found then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
end;
$$;

-- Ends an active link now (switched or released).
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: school_release_student, learner_accept_school_link, settle_payment
create or replace function private.end_link(p_link_id uuid, p_reason public.link_end_reason)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  update public.school_student_links
     set status = 'ended', end_reason = p_reason, ended_at = v_now
   where id = p_link_id and status = 'active' and ends_at > v_now;

  if not found then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function private.confirmed_user_id(extensions.citext) from public;
revoke all on function private.close_expired_links(uuid, extensions.citext) from public;
revoke all on function private.current_link_id(uuid) from public;
revoke all on function private.activate_link(uuid, uuid) from public;
revoke all on function private.end_link(uuid, public.link_end_reason) from public;
grant execute on function private.confirmed_user_id(extensions.citext) to service_role;
grant execute on function private.close_expired_links(uuid, extensions.citext) to service_role;
grant execute on function private.current_link_id(uuid) to service_role;
grant execute on function private.activate_link(uuid, uuid) to service_role;
grant execute on function private.end_link(uuid, public.link_end_reason) to service_role;

comment on function private.confirmed_user_id(extensions.citext) is
  'The confirmed account with this email, or null. Unconfirmed addresses never match.';
comment on function private.close_expired_links(uuid, extensions.citext) is
  'Marks active links past their month as ended (expired) for a learner or email.';
comment on function private.current_link_id(uuid) is
  'The learner''s current link: active and inside its month, or null.';
comment on function private.activate_link(uuid, uuid) is
  'Starts a pending link now, a month long.';
comment on function private.end_link(uuid, public.link_end_reason) is
  'Ends an active link early (switched or released).';
