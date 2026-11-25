-- ===================================================
-- TABLE: public.school_member_invites
-- ===================================================
-- An owner or admin added by an email that has no confirmed account yet. When
-- that email confirms, match_pending_invites turns it into a school_members
-- row (with its branches). A pending admin invite counts toward the 50.
create table public.school_member_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  email extensions.citext not null check (email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.school_role not null,
  branch_ids uuid[] not null default '{}',
  status public.invite_status not null default 'pending',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check ((status = 'pending') = (closed_at is null))
);

create unique index school_member_invites_open_idx
  on public.school_member_invites (school_id, email) where status = 'pending';

create index school_member_invites_email_idx
  on public.school_member_invites (email) where status = 'pending';

create index school_member_invites_invited_by_idx on public.school_member_invites (invited_by);

comment on table public.school_member_invites is
  'An owner or admin added by an email with no confirmed account yet; taken up on confirmation.';
