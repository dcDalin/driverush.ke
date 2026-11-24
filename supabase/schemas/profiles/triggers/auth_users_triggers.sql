-- ===================================================
-- TRIGGERS: auth.users and profiles
-- ===================================================
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace trigger on_auth_user_updated
  after update of email, email_confirmed_at on auth.users
  for each row execute function private.handle_auth_user_updated();

create or replace trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();
