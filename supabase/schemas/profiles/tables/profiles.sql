-- ===================================================
-- TABLE: public.profiles
-- ===================================================
-- One row per account, created by handle_new_user when Supabase Auth adds
-- the user. email mirrors auth.users.email (kept in sync by a trigger) so
-- schools and staff can see who a learner is without reading auth.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext,
  full_name text check (full_name is null or char_length(full_name) between 1 and 120),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (email);

comment on table public.profiles is
  'One row per account. email mirrors auth.users; learners edit full_name and avatar_url.';
