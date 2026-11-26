-- ===================================================
-- REALTIME: dashboards that update themselves (owner, 2026-11-26)
-- ===================================================
-- A school's dashboard and the DriveRush console listen on private broadcast
-- topics and re-read their loaders when something changes, as thinkrush's
-- admin console does:
--
--   school:<school_id>  a payment through the school settled or was refunded,
--                       a student was added, joined, moved or left, an admin
--                       or invite changed, its bank or price changed
--   console             any payment, any bank waiting for a check
--
-- The message says only which table changed and how: never a name, an email
-- or an amount. The page re-reads its own data through row level security.
-- Broadcasting never fails the write that caused it.
--
-- Who may listen: the policy on realtime.messages below. Every channel is
-- private; no client may broadcast (no INSERT policy): only the database does
-- (realtime.send).

-- Access:  trigger (never called directly; service_role only)
-- Guard:   none (the grant is the gate)
-- Callers: triggers on payments, school_student_links, school_members,
--          school_member_invites, school_payment_settings
create or replace function private.broadcast_school_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid := coalesce(
    (to_jsonb(NEW) ->> 'school_id')::uuid,
    (to_jsonb(OLD) ->> 'school_id')::uuid
  );
  v_payload jsonb := jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP);
  v_console boolean := TG_TABLE_NAME in ('payments', 'school_payment_settings');
begin
  begin
    if v_school_id is not null then
      execute 'select realtime.send($1, $2, $3, $4)'
        using v_payload, lower(TG_OP), 'school:' || v_school_id::text, true;
    end if;
    if v_console then
      execute 'select realtime.send($1, $2, $3, $4)'
        using v_payload, lower(TG_OP), 'console', true;
    end if;
  exception
    when others then
      raise warning '[school-broadcast] % on %: % (sqlstate %)',
        TG_OP, TG_TABLE_NAME, sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

revoke all on function private.broadcast_school_change() from public;
grant execute on function private.broadcast_school_change() to service_role;

comment on function private.broadcast_school_change() is
  'Trigger: tells school:<id> (and console, for money) that a table changed; no row data.';

-- A payment matters to a dashboard once it settles, fails or is refunded.
create or replace trigger payments_broadcast
  after update of status on public.payments
  for each row
  when (OLD.status is distinct from NEW.status)
  execute function private.broadcast_school_change();

create or replace trigger school_student_links_broadcast
  after insert or update or delete on public.school_student_links
  for each row execute function private.broadcast_school_change();

create or replace trigger school_members_broadcast
  after insert or update or delete on public.school_members
  for each row execute function private.broadcast_school_change();

create or replace trigger school_member_invites_broadcast
  after insert or update or delete on public.school_member_invites
  for each row execute function private.broadcast_school_change();

create or replace trigger school_payment_settings_broadcast
  after insert or update on public.school_payment_settings
  for each row execute function private.broadcast_school_change();

-- ===================================================
-- ACCESS: realtime.messages (who hears which topic)
-- ===================================================
-- Reads:  school:<id>: that school's owner and admins, and DriveRush staff.
--         console: DriveRush staff. Any other topic: nobody.
-- Writes: No client (no INSERT policy): only realtime.send in the database.
drop policy if exists "realtime.messages: topic-gated read" on realtime.messages;

create policy "realtime.messages: topic-gated read"
  on realtime.messages for select to authenticated
  using (
    extension = 'broadcast'
    and case
      when topic = 'console' then (select private.is_staff())
      when topic ~ '^school:[0-9a-f-]{36}$' then
        (select private.is_staff())
        or private.is_school_member(substr(topic, 8)::uuid)
      else false
    end
  );
