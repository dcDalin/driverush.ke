-- ===================================================
-- TRIGGERS: schools
-- ===================================================
create or replace trigger schools_set_updated_at
  before update on public.schools
  for each row execute function private.set_updated_at();

create or replace trigger school_branches_set_updated_at
  before update on public.school_branches
  for each row execute function private.set_updated_at();

-- At most 50 admins per school, pending admin invites included.
create or replace trigger school_members_admin_limit
  before insert or update of role on public.school_members
  for each row execute function private.enforce_member_admin_limit();

create or replace trigger school_member_invites_admin_limit
  before insert or update of role, status on public.school_member_invites
  for each row execute function private.enforce_invite_admin_limit();

create or replace trigger school_profiles_set_updated_at
  before update on public.school_profiles
  for each row execute function private.set_updated_at();
