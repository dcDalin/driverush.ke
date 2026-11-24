-- ===================================================
-- TABLE: public.subscription_pauses
-- ===================================================
-- Each time a school link pushed a learner's paid time forward: by how much,
-- and whether the subscription's start moved too (it had not started yet).
-- When the link ends early, the unused part is taken back from here. Internal:
-- no client reads it.
create table public.subscription_pauses (
  subscription_id uuid not null references public.learner_subscriptions (id) on delete cascade,
  link_id uuid not null references public.school_student_links (id) on delete cascade,
  shifted_by interval not null check (shifted_by >= interval '0'),
  moved_start boolean not null,
  created_at timestamptz not null default now(),
  primary key (subscription_id, link_id)
);

create index subscription_pauses_link_idx on public.subscription_pauses (link_id);

comment on table public.subscription_pauses is
  'How far each school link pushed a learner''s paid time forward. Internal.';
