-- ===================================================
-- ENUMS: students
-- ===================================================
-- pending: added by a school, waiting for the email to sign up or for the
--          learner to choose it. active: the one-month link (counts only
--          while now() < ends_at). ended: ran its month or ended early.
--          declined: the learner said no. cancelled: the school withdrew it
--          before it started.
create type public.student_link_status as enum ('pending', 'active', 'ended', 'declined', 'cancelled');

comment on type public.student_link_status is
  'A school-learner link: pending, active (until ends_at), ended, declined or cancelled.';

create type public.link_end_reason as enum ('expired', 'switched', 'released');

comment on type public.link_end_reason is
  'Why an active link ended: its month ran out, the learner switched school, or the school released them.';
