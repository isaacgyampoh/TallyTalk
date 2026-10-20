-- ============================================================================
-- Local stand-in for the parts of a Supabase project that our migrations
-- assume but do not create: the auth and storage schemas, the three API roles,
-- and the realtime publication.
--
-- This exists so the migrations can be applied to a throwaway Postgres cluster
-- and the policies and triggers exercised for real, as the roles the app
-- actually connects as. It is NOT a Supabase emulator: PostgREST, GoTrue,
-- Storage and Realtime are not here, so what these tests prove is the
-- database's own behaviour — which is where every security decision in this
-- app lives.
--
-- Each definition below mirrors the hosted one closely enough for the policies
-- to mean the same thing; where it is a simplification, the comment says so.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Supabase's three API roles. `service_role` bypasses RLS there, so it does
-- here too; `anon` and `authenticated` are the ones the client uses.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

-- ---------------------------------------------------------------------------
-- auth.users — only the columns our migrations touch. GoTrue owns this table
-- in a real project; inserting here is how these tests simulate a sign-up,
-- which is exactly what fires on_auth_user_created.
-- ---------------------------------------------------------------------------
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  phone              text unique,
  email              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- The request's identity, as Supabase derives it: PostgREST sets
-- `request.jwt.claims` per statement, and these read it back.
create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', current_setting('role', true))
$$;

-- ---------------------------------------------------------------------------
-- storage — buckets and objects, with RLS on, so the storage policies in 0001
-- and 0003 can be tested as written. The real table has more columns; none of
-- them appear in our policies.
-- ---------------------------------------------------------------------------
create table if not exists storage.buckets (
  id         text primary key,
  name       text not null,
  public     boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text not null,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

-- Supabase's own definition: the path segments above the file name.
create or replace function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1:array_length(parts, 1) - 1];
end
$$;

-- ---------------------------------------------------------------------------
-- pg_net, which 0005 uses to call the send-push function. The real extension
-- queues an HTTP request on a background worker; this records the call instead,
-- so a test can assert exactly who would have been notified and with what.
-- Nothing here sends anything anywhere.
-- ---------------------------------------------------------------------------
create schema if not exists net;

create table if not exists net.captured (
  id      bigserial primary key,
  url     text not null,
  headers jsonb,
  body    jsonb,
  at      timestamptz not null default now()
);

create or replace function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{"Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds integer default 5000
) returns bigint language plpgsql as $$
declare
  request_id bigint;
begin
  insert into net.captured (url, headers, body)
  values (url, headers, body)
  returning id into request_id;
  return request_id;
end
$$;

-- ---------------------------------------------------------------------------
-- Supabase Vault, where 0005 keeps the function URL and the shared secret.
-- The real one encrypts at rest; this only has to answer the same query.
-- ---------------------------------------------------------------------------
create schema if not exists vault;
create table if not exists vault.decrypted_secrets (
  id               uuid primary key default gen_random_uuid(),
  name             text unique,
  decrypted_secret text
);

-- Realtime publishes through this; the migrations add tables to it.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
