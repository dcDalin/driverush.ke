-- ===================================================
-- TABLE: public.school_student_links
-- ===================================================
-- A school adds a learner by email to one of its branches. The link starts
-- (status active, a month long) when the email matches a confirmed account;
-- until then it is pending. A learner has at most one active link; another
-- school's add waits as pending until the learner chooses it
-- (learner_accept_school_link). Rows are history: re-adding after a month
-- ends inserts a new row. Writes go through the functions in
-- students/functions only.
create table public.school_student_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  branch_id uuid not null,
  email extensions.citext not null check (email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  user_id uuid references auth.users (id) on delete cascade,
  status public.student_link_status not null default 'pending',
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  starts_at timestamptz,
  ends_at timestamptz,
  ended_at timestamptz,
  end_reason public.link_end_reason,
  foreign key (branch_id, school_id)
    references public.school_branches (id, school_id),
  -- The dates each status carries.
  check (
    case status
      when 'pending' then starts_at is null and ends_at is null and ended_at is null and end_reason is null
      when 'active' then user_id is not null and starts_at is not null and ends_at > starts_at
                         and ended_at is null and end_reason is null
      when 'ended' then user_id is not null and starts_at is not null and ends_at > starts_at
                        and ended_at is not null and end_reason is not null
      else starts_at is null and ends_at is null and ended_at is not null and end_reason is null
    end
  )
);

-- At most one active link per learner (an expired one is closed before
-- another starts: private.close_expired_links).
create unique index school_student_links_one_active_idx
  on public.school_student_links (user_id) where status = 'active';

-- One open link per school and email.
create unique index school_student_links_open_idx
  on public.school_student_links (school_id, email) where status in ('pending', 'active');

create index school_student_links_email_idx
  on public.school_student_links (email) where status = 'pending';
create index school_student_links_branch_idx
  on public.school_student_links (branch_id, status);

comment on table public.school_student_links is
  'A school''s one-month link to a learner, added by email to a branch. History is kept.';
