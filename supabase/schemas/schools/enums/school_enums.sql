-- ===================================================
-- ENUMS: schools
-- ===================================================
create type public.school_status as enum ('active', 'suspended', 'archived');

comment on type public.school_status is
  'active: links learners and shows its livery. suspended or archived: neither.';

-- owner: the school's su, one per school, set by DriveRush staff. admin: added
-- by the owner and tied to one or more branches (at most 50 per school).
create type public.school_role as enum ('owner', 'admin');

comment on type public.school_role is
  'owner (the school su, one per school) or admin (tied to branches, at most 50 per school).';

create type public.invite_status as enum ('pending', 'accepted', 'cancelled');

comment on type public.invite_status is
  'A school member invite waiting for its email to sign up, taken up, or withdrawn.';
