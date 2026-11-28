-- ===================================================
-- EXTENSIONS
-- ===================================================
-- citext: case-insensitive email columns, so a school adding
-- "Wanjiru@Mail.com" matches the learner who signed up as "wanjiru@mail.com".
create extension if not exists citext with schema extensions;
