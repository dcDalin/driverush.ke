-- ===================================================
-- TABLE: public.school_sponsorships
-- ===================================================
-- The paid time a school sponsors the board: while one is current and the
-- school has a live livery, its cars take turns for guests and free
-- learners. Dates are Kenyan calendar days; ends_on null runs until ended.
-- Set by DriveRush staff (admin_set_sponsorship, admin_end_sponsorship).
create table public.school_sponsorships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  starts_on date not null,
  ends_on date,
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create index school_sponsorships_school_idx on public.school_sponsorships (school_id, starts_on);
create index school_sponsorships_created_by_idx on public.school_sponsorships (created_by);

comment on table public.school_sponsorships is
  'When a school sponsors the board (its cars rotate for guests and free learners). Staff only.';
