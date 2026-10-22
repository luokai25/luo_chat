-- Owner-only synthetic evidence. This is not a full Supabase schema or backup.
create schema if not exists reliability_lab;
create table if not exists reliability_lab.release_checks (
  release_ref text primary key,
  checked_at timestamptz not null default now(),
  result jsonb not null check (jsonb_typeof(result)='object')
);
