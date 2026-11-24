-- ===================================================
-- FUNCTIONS: a learner's paid time pauses during a school month
-- ===================================================
-- No cron: when a link starts, every live or future subscription of the
-- learner that overlaps the link is pushed forward by the overlap (a
-- subscription that had not started yet now starts when the link ends).
-- When a link ends early, the unused part is taken back. A link that runs
-- its full month needs nothing: the push was exact.

-- Pushes one subscription past one link and records it.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.pause_subscriptions_for_link, private.pause_new_subscription
create or replace function private.pause_subscription(p_subscription_id uuid, p_link_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_sub public.learner_subscriptions;
  v_link public.school_student_links;
  v_shift interval;
  v_moved boolean;
begin
  select * into v_sub from public.learner_subscriptions where id = p_subscription_id for update;
  select * into v_link from public.school_student_links where id = p_link_id;

  if v_sub.status <> 'active' or v_link.status <> 'active'
     or v_sub.ends_at <= v_link.starts_at or v_sub.starts_at >= v_link.ends_at then
    return;
  end if;

  v_moved := v_sub.starts_at >= v_link.starts_at;
  v_shift := v_link.ends_at - greatest(v_sub.starts_at, v_link.starts_at);

  update public.learner_subscriptions
     set starts_at = case when v_moved then starts_at + v_shift else starts_at end,
         ends_at = ends_at + v_shift
   where id = v_sub.id;

  insert into public.subscription_pauses (subscription_id, link_id, shifted_by, moved_start)
  values (v_sub.id, v_link.id, v_shift, v_moved)
  on conflict (subscription_id, link_id)
  do update set shifted_by = public.subscription_pauses.shifted_by + excluded.shifted_by;
end;
$$;

-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.activate_link
create or replace function private.pause_subscriptions_for_link(p_link_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_link public.school_student_links;
  v_sub_id uuid;
begin
  select * into v_link from public.school_student_links where id = p_link_id;
  for v_sub_id in
    select s.id from public.learner_subscriptions as s
     where s.user_id = v_link.user_id
       and s.status = 'active'
       and s.ends_at > v_link.starts_at
       and s.starts_at < v_link.ends_at
     order by s.starts_at
  loop
    perform private.pause_subscription(v_sub_id, p_link_id);
  end loop;
end;
$$;

-- Gives back the part of the pause a link did not use: it ended at p_at,
-- before its month was up.
--
-- Access:  service_role
-- Guard:   none (the grant is the gate)
-- Callers: private.end_link
create or replace function private.resume_subscriptions_for_link(p_link_id uuid, p_at timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_link public.school_student_links;
  v_pause public.subscription_pauses;
  v_back interval;
begin
  select * into v_link from public.school_student_links where id = p_link_id;
  if p_at >= v_link.ends_at then
    return;
  end if;

  for v_pause in
    select * from public.subscription_pauses where link_id = p_link_id for update
  loop
    v_back := least(v_link.ends_at - p_at, v_pause.shifted_by);
    update public.learner_subscriptions
       set starts_at = case when v_pause.moved_start then starts_at - v_back else starts_at end,
           ends_at = ends_at - v_back
     where id = v_pause.subscription_id;
    update public.subscription_pauses
       set shifted_by = shifted_by - v_back
     where subscription_id = v_pause.subscription_id and link_id = p_link_id;
  end loop;
end;
$$;

-- A subscription bought while a school link is current starts when the link ends.
--
-- Access:  trigger
-- Guard:   none (the grant is the gate)
-- Callers: trigger on learner_subscriptions
create or replace function private.pause_new_subscription()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_link_id uuid;
begin
  select l.id into v_link_id
    from public.school_student_links as l
   where l.user_id = new.user_id and l.status = 'active' and l.ends_at > now()
   limit 1;
  if v_link_id is not null then
    perform private.pause_subscription(new.id, v_link_id);
  end if;
  return null;
end;
$$;

revoke all on function private.pause_subscription(uuid, uuid) from public;
revoke all on function private.pause_subscriptions_for_link(uuid) from public;
revoke all on function private.resume_subscriptions_for_link(uuid, timestamptz) from public;
revoke all on function private.pause_new_subscription() from public;
grant execute on function private.pause_subscription(uuid, uuid) to service_role;
grant execute on function private.pause_subscriptions_for_link(uuid) to service_role;
grant execute on function private.resume_subscriptions_for_link(uuid, timestamptz) to service_role;
grant execute on function private.pause_new_subscription() to service_role;

comment on function private.pause_subscription(uuid, uuid) is
  'Pushes a learner subscription past the part of a school link it overlaps, and records the push.';
comment on function private.pause_subscriptions_for_link(uuid) is
  'On a link starting: pauses every overlapping subscription of the learner.';
comment on function private.resume_subscriptions_for_link(uuid, timestamptz) is
  'On a link ending early: takes back the unused part of each pause it caused.';
comment on function private.pause_new_subscription() is
  'Trigger: a subscription bought during a current school link starts when the link ends.';
