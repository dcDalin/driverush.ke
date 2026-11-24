-- ===================================================
-- FUNCTION: my_entitlement
-- ===================================================
-- What the signed-in learner gets right now, for the app to decide content
-- and livery:
--   school  a current link with an active school: full access, that school's
--           livery (sponsor_id), until ends_at
--   paid    their own subscription is running: full access, plain cars
--   free    a free account: progress saved, sponsor schools take turns
-- A school link beats paid time (which is paused meanwhile).
-- pending_invites counts schools waiting for the learner to choose them.
--
-- Access:  authenticated (the learner)
-- Guard:   self (answers for auth.uid() only)
-- Callers: web (learner session)
create or replace function private.my_entitlement()
returns table (
  tier text,
  school_id uuid,
  school_name text,
  sponsor_id text,
  branch_id uuid,
  ends_at timestamptz,
  pending_invites integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_link public.school_student_links;
  v_school public.schools;
  v_paid_until timestamptz;
  v_pending integer;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*)::integer into v_pending
    from public.school_student_links as l
    join public.schools as s on s.id = l.school_id and s.status = 'active'
   where l.user_id = v_uid and l.status = 'pending';

  select * into v_link from public.school_student_links
   where id = private.current_link_id(v_uid);
  if v_link.id is not null then
    select * into v_school from public.schools where id = v_link.school_id and status = 'active';
  end if;

  if v_school.id is not null then
    return query select 'school'::text, v_school.id, v_school.name, v_school.sponsor_id,
                        v_link.branch_id, v_link.ends_at, v_pending;
    return;
  end if;

  select max(s.ends_at) into v_paid_until
    from public.learner_subscriptions as s
   where s.user_id = v_uid and s.status = 'active'
     and s.starts_at <= now() and s.ends_at > now();

  if v_paid_until is not null then
    return query select 'paid'::text, null::uuid, null::text, null::text, null::uuid, v_paid_until, v_pending;
    return;
  end if;

  return query select 'free'::text, null::uuid, null::text, null::text, null::uuid, null::timestamptz, v_pending;
end;
$$;

-- Access:  authenticated (the learner)
-- Guard:   self (the private body answers for auth.uid() only)
-- Callers: web (learner session)
create or replace function public.my_entitlement()
returns table (
  tier text,
  school_id uuid,
  school_name text,
  sponsor_id text,
  branch_id uuid,
  ends_at timestamptz,
  pending_invites integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.my_entitlement();
$$;

revoke all on function private.my_entitlement() from public;
revoke all on function public.my_entitlement() from public;
grant execute on function private.my_entitlement() to service_role;
grant execute on function public.my_entitlement() to service_role;

comment on function private.my_entitlement() is
  'The signed-in learner''s tier now (school, paid or free), with the school livery and pending invites.';
comment on function public.my_entitlement() is
  'The signed-in learner''s tier now (school, paid or free), with the school livery and pending invites.';
