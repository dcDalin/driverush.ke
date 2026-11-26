-- ===================================================
-- FUNCTION: private.match_pending_invites
-- ===================================================
-- Runs when an account's email is confirmed (sign-up, or an email change).
--
-- School member invites for that email become memberships, with their
-- branches. An owner invite replaces the school's current owner.
--
-- Student links for that email are tied to the account. If the learner has no
-- current link and exactly one pending link, it starts now. With two or more
-- pending, nothing starts: the learner chooses (learner_accept_school_link).
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.handle_new_user, private.handle_auth_user_updated
create or replace function private.match_pending_invites(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email extensions.citext;
  v_invite public.school_member_invites;
  v_member_id uuid;
  v_pending_ids uuid[];
begin
  select u.email::extensions.citext into v_email
    from auth.users as u
   where u.id = p_user_id and u.email_confirmed_at is not null;
  if v_email is null then
    return;
  end if;

  -- School owners and admins.
  for v_invite in
    select * from public.school_member_invites
     where email = v_email and status = 'pending' and expires_at > now()
     order by created_at
     for update
  loop
    update public.school_member_invites
       set status = 'accepted', closed_at = now()
     where id = v_invite.id;

    if v_invite.role = 'owner' then
      perform private.step_down_owner(v_invite.school_id, p_user_id, v_invite.keep_previous_owner);
    end if;

    insert into public.school_members (school_id, user_id, role, added_by)
    values (v_invite.school_id, p_user_id, v_invite.role, v_invite.invited_by)
    on conflict (school_id, user_id) do update
      set role = case when excluded.role = 'owner' then 'owner'::public.school_role
                      else public.school_members.role end
    returning id into v_member_id;

    if v_invite.role = 'admin' then
      insert into public.school_member_branches (member_id, branch_id, school_id)
      select v_member_id, b.id, b.school_id
        from public.school_branches as b
       where b.school_id = v_invite.school_id and b.id = any (v_invite.branch_ids)
      on conflict do nothing;
    end if;
  end loop;

  -- Student links.
  update public.school_student_links
     set user_id = p_user_id
   where email = v_email and status = 'pending' and user_id is null;

  perform private.close_expired_links(p_user_id, v_email);

  if private.current_link_id(p_user_id) is null then
    select array_agg(l.id) into v_pending_ids
      from public.school_student_links as l
      join public.schools as s on s.id = l.school_id and s.status = 'active'
     where l.user_id = p_user_id and l.status = 'pending' and l.expires_at > now();

    if coalesce(array_length(v_pending_ids, 1), 0) = 1 then
      perform private.activate_link(v_pending_ids[1], p_user_id);
    end if;
  end if;
end;
$$;

revoke all on function private.match_pending_invites(uuid) from public;
grant execute on function private.match_pending_invites(uuid) to service_role;

comment on function private.match_pending_invites(uuid) is
  'On email confirmation: takes up school member invites and starts the learner''s only pending school link.';
