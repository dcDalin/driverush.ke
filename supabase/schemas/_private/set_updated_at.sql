-- ===================================================
-- FUNCTION: private.set_updated_at
-- ===================================================
-- Stamps updated_at on every update of a table that has the column.
--
-- Access:  trigger
-- Guard:   none (the grant is the gate)
-- Callers: trigger on profiles, schools, school_branches, learner_subscriptions, school_subscriptions, learner_progress
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;
grant execute on function private.set_updated_at() to service_role;

comment on function private.set_updated_at() is
  'Trigger: stamps updated_at with now() on update.';
