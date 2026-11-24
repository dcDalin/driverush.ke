-- ===================================================
-- ENUM: public.app_role
-- ===================================================
-- Platform roles. driverush_su runs the platform and manages staff roles;
-- driverush_admin creates and runs schools; user is every learner (and every
-- school owner or admin, whose school rights live in school_members, not here).
create type public.app_role as enum ('driverush_su', 'driverush_admin', 'user');

comment on type public.app_role is
  'Platform role: driverush_su, driverush_admin or user. School rights are in school_members.';
