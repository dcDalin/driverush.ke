-- ===================================================
-- TABLE: public.user_roles
-- ===================================================
-- The platform roles each account holds. Sign-up adds `user`; a su grants
-- driverush_admin or driverush_su through grant_platform_role.
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

comment on table public.user_roles is
  'Platform roles per account. The access token carries the highest as user_role.';
