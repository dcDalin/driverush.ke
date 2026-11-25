-- ===================================================
-- FUNCTION: my_entitlement
-- ===================================================
-- What the signed-in learner gets right now, for the app to decide content
-- and livery (owner, 2026-11-25):
--   tier    school  a current link with an active school: that school's car
--                   (school_slug, looked up in board_schools()); ends_at is
--                   the link's end
--           paid    no school link, a pass running: sponsor schools take
--                   turns; ends_at is the pass's end
--           free    neither
--   full_access     a pass is running now (bought alone or through a school):
--                   the course past the free levels opens
--   pass_ends_at    when the learner's passes run out (they are back to back)
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
  school_slug text,
  branch_id uuid,
  ends_at timestamptz,
  pending_invites integer,
  full_access boolean,
  pass_ends_at timestamptz
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

  select max(s.ends_at) into v_paid_until
    from public.learner_subscriptions as s
   where s.user_id = v_uid and s.status = 'active' and s.ends_at > now()
     and exists (
       select 1 from public.learner_subscriptions as n
        where n.user_id = v_uid and n.status = 'active'
          and n.starts_at <= now() and n.ends_at > now()
     );

  select * into v_link from public.school_student_links
   where id = private.current_link_id(v_uid);
  if v_link.id is not null then
    select * into v_school from public.schools where id = v_link.school_id and status = 'active';
  end if;

  if v_school.id is not null then
    return query select 'school'::text, v_school.id, v_school.name, v_school.slug,
                        v_link.branch_id, v_link.ends_at, v_pending,
                        v_paid_until is not null, v_paid_until;
    return;
  end if;

  if v_paid_until is not null then
    return query select 'paid'::text, null::uuid, null::text, null::text, null::uuid,
                        v_paid_until, v_pending, true, v_paid_until;
    return;
  end if;

  return query select 'free'::text, null::uuid, null::text, null::text, null::uuid,
                      null::timestamptz, v_pending, false, null::timestamptz;
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
  school_slug text,
  branch_id uuid,
  ends_at timestamptz,
  pending_invites integer,
  full_access boolean,
  pass_ends_at timestamptz
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
  'The signed-in learner''s tier now (school, paid or free), whether a pass is running, the school livery and pending invites.';
comment on function public.my_entitlement() is
  'The signed-in learner''s tier now (school, paid or free), whether a pass is running, the school livery and pending invites.';
