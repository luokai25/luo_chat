-- App clients need row-level operations and checked RPCs, not table-level maintenance.
-- Keep service-role permissions intact. No data changes.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from anon, authenticated;
