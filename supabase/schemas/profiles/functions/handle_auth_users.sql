-- ===================================================
-- FUNCTIONS: keeping profiles in step with auth.users
-- ===================================================

-- A new account gets its profile and the `user` role. If it arrives
-- confirmed (Google, or created confirmed by an admin), invites match now.
--
-- Access:  trigger
-- Guard:   none (the grant is the gate)
-- Callers: trigger on auth.users
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 120), ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'avatar_url', ''), 2048), '')
  );

  insert into public.user_roles (user_id, role) values (new.id, 'user');

  if new.email_confirmed_at is not null then
    perform private.match_pending_invites(new.id);
  end if;
  return new;
end;
$$;

-- An email confirmed or changed: the profile follows, and invites for the
-- (newly confirmed) address match.
--
-- Access:  trigger
-- Guard:   none (the grant is the gate)
-- Callers: trigger on auth.users
create or replace function private.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;

  if new.email_confirmed_at is not null
     and (old.email_confirmed_at is null or new.email is distinct from old.email) then
    perform private.match_pending_invites(new.id);
  end if;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
revoke all on function private.handle_auth_user_updated() from public;
grant execute on function private.handle_new_user() to service_role;
grant execute on function private.handle_auth_user_updated() to service_role;

comment on function private.handle_new_user() is
  'Trigger: a new account gets a profile and the user role; a confirmed one matches its invites.';
comment on function private.handle_auth_user_updated() is
  'Trigger: keeps profiles.email in step and matches invites when an email is confirmed.';
