-- ===================================================
-- FUNCTIONS: at most 50 admins per school
-- ===================================================
-- Admins are school_members with role admin plus pending admin invites; the
-- owner does not count. Each check locks the school row first, so two adds at
-- once cannot both take the 50th place. Refuses with SQLSTATE P0001,
-- message 'admin_limit'.

-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.enforce_member_admin_limit, private.enforce_invite_admin_limit
create or replace function private.assert_admin_room(p_school_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform 1 from public.schools where id = p_school_id for update;

  select (select count(*) from public.school_members
           where school_id = p_school_id and role = 'admin')
       + (select count(*) from public.school_member_invites
           where school_id = p_school_id and role = 'admin' and status = 'pending'
             and expires_at > now())
    into v_count;

  if v_count >= 50 then
    raise exception 'admin_limit' using
      errcode = 'P0001',
      detail = 'A school has at most 50 admins (pending invites count).';
  end if;
end;
$$;

-- Access:  trigger
-- Guard:   none (the grant is the gate)
-- Callers: trigger on school_members
create or replace function private.enforce_member_admin_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'admin' and (tg_op = 'INSERT' or old.role is distinct from 'admin') then
    perform private.assert_admin_room(new.school_id);
  end if;
  return new;
end;
$$;

-- Access:  trigger
-- Guard:   none (the grant is the gate)
-- Callers: trigger on school_member_invites
create or replace function private.enforce_invite_admin_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'admin' and new.status = 'pending'
     and (tg_op = 'INSERT' or old.status is distinct from 'pending' or old.role is distinct from 'admin') then
    perform private.assert_admin_room(new.school_id);
  end if;
  return new;
end;
$$;

revoke all on function private.assert_admin_room(uuid) from public;
revoke all on function private.enforce_member_admin_limit() from public;
revoke all on function private.enforce_invite_admin_limit() from public;
grant execute on function private.assert_admin_room(uuid) to service_role;
grant execute on function private.enforce_member_admin_limit() to service_role;
grant execute on function private.enforce_invite_admin_limit() to service_role;

comment on function private.assert_admin_room(uuid) is
  'Refuses (P0001 admin_limit) when the school already has 50 admins, counting pending admin invites.';
comment on function private.enforce_member_admin_limit() is
  'Trigger: a new or promoted school admin must fit within the 50.';
comment on function private.enforce_invite_admin_limit() is
  'Trigger: a pending admin invite must fit within the 50.';
