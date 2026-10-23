-- FREE CI-only Supabase Auth/Postgres fixture, never production.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema luo_internal;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table auth.users (
 id uuid primary key,
 email text unique,
 raw_app_meta_data jsonb not null default '{}'::jsonb
);
create table public.auth_signup_attempts (
 email_hash text not null,
 ip_hash text not null,
 attempted_at timestamptz not null default now()
);
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','legacy@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','old-account@example.invalid');
