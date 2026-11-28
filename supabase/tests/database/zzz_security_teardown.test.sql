-- ===================================================
-- pgTAP: teardown for the security manifest (runs last)
-- ===================================================
-- Drops the `tests` schema that 000_security_manifest.test.sql creates, so
-- a test run leaves the database as it found it.
-- ===================================================
drop schema if exists tests cascade;

begin;
create extension if not exists pgtap with schema extensions;

select plan(1);

select hasnt_schema('tests', 'the tests schema is gone after the run');

select * from finish();
rollback;
