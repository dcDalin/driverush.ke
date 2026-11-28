-- ===================================================
-- FUNCTION: public.custom_access_token_hook
-- ===================================================
-- Supabase Auth runs this before it issues a token. It writes the highest
-- platform role the account holds into the user_role claim, downgraded to
-- `user` unless the session signed in with a password or Google
-- (private.signed_in_for_staff has the same rule), so an emailed code never
-- carries a console role. The claim is for the app's
-- routing only; the database checks user_roles itself (private.is_staff).
--
-- Access:  auth_hook
-- Guard:   none (the grant is the gate)
-- Callers: Supabase Auth (access token hook)
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims jsonb := event -> 'claims';
  v_role public.app_role;
begin
  select r.role into v_role
    from public.user_roles as r
   where r.user_id = (event ->> 'user_id')::uuid
   order by case r.role
     when 'driverush_su' then 1
     when 'driverush_admin' then 2
     else 3
   end
   limit 1;

  if v_role in ('driverush_su', 'driverush_admin')
     and not exists (
       select 1
         from jsonb_array_elements(
                case when jsonb_typeof(v_claims -> 'amr') = 'array'
                     then v_claims -> 'amr'
                     else '[]'::jsonb
                end
              ) as m
        where m ->> 'method' in ('password', 'oauth')
     ) then
    v_role := 'user';
  end if;

  v_claims := jsonb_set(v_claims, '{user_role}', coalesce(to_jsonb(v_role), 'null'::jsonb));
  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

revoke all on function public.custom_access_token_hook(jsonb) from public;
grant execute on function public.custom_access_token_hook(jsonb) to service_role;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

comment on function public.custom_access_token_hook(jsonb) is
  'Supabase Auth hook: adds the highest platform role as user_role (console roles only on a password or Google session).';
