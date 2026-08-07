-- ============================================================================
-- TallyTalk — push notification device tokens
-- Run after 0001_init.sql (Supabase SQL Editor or `supabase db push`).
-- ============================================================================

create table public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null,
  platform   text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);
create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- A user manages only their own device tokens.
create policy push_tokens_own on public.push_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger push_tokens_touch before update on public.push_tokens
  for each row execute function public.touch_updated_at();
