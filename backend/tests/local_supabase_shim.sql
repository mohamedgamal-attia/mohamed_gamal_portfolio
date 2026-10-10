-- Minimal local stand-in for the pieces of Supabase the migration depends on.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);

-- Supabase sets request.jwt.claims per request; auth.uid() reads it.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
