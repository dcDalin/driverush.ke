-- ===================================================
-- FUNCTIONS: a learner chooses among schools that added them
-- ===================================================

-- Starts a pending link now. A current link with another school ends early
-- (reason switched; that school sees it in its history).
--
-- Access:  authenticated (the learner the link is for)
-- Guard:   self (the link's user_id is auth.uid())
-- Callers: web (learner session)
create or replace function private.learner_accept_school_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_link public.school_student_links;
  v_current uuid;
begin
  select * into v_link from public.school_student_links where id = p_link_id for update;
  if v_uid is null or v_link.id is null or v_link.user_id is distinct from v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_link.status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  if v_link.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.schools where id = v_link.school_id and status = 'active') then
    raise exception 'school_inactive' using errcode = 'P0001';
  end if;

  perform private.close_expired_links(v_uid, null);
  v_current := private.current_link_id(v_uid);
  if v_current is not null then
    perform private.end_link(v_current, 'switched');
  end if;
  perform private.activate_link(p_link_id, v_uid);
end;
$$;

-- Access:  authenticated (the learner the link is for)
-- Guard:   self (the link's user_id is auth.uid())
-- Callers: web (learner session)
create or replace function private.learner_decline_school_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.school_student_links
     set status = 'declined', ended_at = now()
   where id = p_link_id and user_id = v_uid and status = 'pending';
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Access:  authenticated (the learner the link is for)
-- Guard:   self (the private body checks the link is the caller's)
-- Callers: web (learner session)
create or replace function public.learner_accept_school_link(p_link_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.learner_accept_school_link(p_link_id);
$$;

-- Access:  authenticated (the learner the link is for)
-- Guard:   self (the private body checks the link is the caller's)
-- Callers: web (learner session)
create or replace function public.learner_decline_school_link(p_link_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.learner_decline_school_link(p_link_id);
$$;

revoke all on function private.learner_accept_school_link(uuid) from public;
revoke all on function private.learner_decline_school_link(uuid) from public;
revoke all on function public.learner_accept_school_link(uuid) from public;
revoke all on function public.learner_decline_school_link(uuid) from public;
grant execute on function private.learner_accept_school_link(uuid) to service_role;
grant execute on function private.learner_decline_school_link(uuid) to service_role;
grant execute on function public.learner_accept_school_link(uuid) to service_role;
grant execute on function public.learner_decline_school_link(uuid) to service_role;

comment on function private.learner_accept_school_link(uuid) is
  'Learner: starts a pending school link now, ending any current one (switched).';
comment on function private.learner_decline_school_link(uuid) is
  'Learner: declines a pending school link.';
comment on function public.learner_accept_school_link(uuid) is
  'Learner: starts a pending school link now, ending any current one (switched).';
comment on function public.learner_decline_school_link(uuid) is
  'Learner: declines a pending school link.';
