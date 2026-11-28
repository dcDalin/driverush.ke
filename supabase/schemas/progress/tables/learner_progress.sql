-- ===================================================
-- TABLE: public.learner_progress
-- ===================================================
-- A signed-in learner's saved progress: one row per app store, holding what
-- that store keeps in localStorage today (data) and the store's persist
-- version. The learner reads and writes their own rows; the owner and branch
-- admins of the learner's current school read them through
-- school_student_progress.
create table public.learner_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  store text not null check (store in (
    'board', 'pelican', 'signs3d', 'streak', 'daily-drive', 'test', 'proud'
  )),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 262144),
  version integer not null default 1 check (version >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, store)
);

comment on table public.learner_progress is
  'A learner''s saved progress, one row per app store (board, pelican, signs3d, streak, daily-drive, test, proud).';
