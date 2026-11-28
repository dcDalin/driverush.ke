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
  -- An owner invite: whether the owner it replaces stays on as an admin of
  -- every branch (owner, 2026-11-26) when the new owner signs up.
  keep_previous_owner boolean not null default false check (not keep_previous_owner or role = 'owner'),
  status public.invite_status not null default 'pending',
  invited_by uuid references auth.users (id) on delete set null,
  -- Lapses 30 days after it was last sent; sent at most 5 times, at least
  -- 10 minutes apart (private.invite_resend). A lapsed invite stays pending
  -- but is never taken up or counted until it is sent again.
  expires_at timestamptz not null default (now() + interval '30 days'),
  sent_count smallint not null default 1 check (sent_count between 1 and 5),
  last_sent_at timestamptz not null default now(),
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
