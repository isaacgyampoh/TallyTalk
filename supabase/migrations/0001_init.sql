-- ============================================================================
-- TaskTally — initial schema migration
-- Target: Supabase (PostgreSQL 15+)
--
-- Design notes
--  * Everything a user can see is gated by Row-Level Security (RLS). The app
--    should never rely on client-side filtering for privacy.
--  * `contacts` rows are DIRECTIONAL: each user classifies the other
--    (work / favorite / archived / blocked) independently. A relationship task
--    "space" between two people is just the set of tasks where they are the
--    requester/assignee pair.
--  * `tasks` covers both 1:1 tasks (assignee_id set, group_id null) and group
--    tasks (group_id set, assignee_id optional). Personal checklist items live
--    in `checklist_items`, not `tasks`.
--  * Helper functions used inside policies are SECURITY DEFINER + STABLE to
--    avoid RLS recursion (e.g. checking group membership from within a
--    group_members policy).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type landing_screen      as enum ('personal', 'contacts', 'groups');
create type privacy_scope        as enum ('everyone', 'my_contacts', 'work_and_favorites', 'nobody');
create type app_theme            as enum ('system', 'light', 'dark');
create type task_status          as enum ('pending_acceptance', 'active', 'completed', 'declined', 'deleted');
create type task_priority        as enum ('urgent', 'high', 'normal', 'low');
create type expected_period      as enum ('today', 'this_week', 'next_week', 'this_month');
create type attachment_type      as enum ('document', 'image', 'audio');
create type group_role           as enum ('administrator', 'member');
create type checklist_kind       as enum ('predefined', 'custom');
create type checklist_behavior   as enum ('normal', 'daily_reset', 'manual_reset', 'call');
create type invitation_status    as enum ('pending', 'accepted', 'declined');

-- ---------------------------------------------------------------------------
-- profiles  (one row per auth user; phone is the primary human identifier)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  phone                  text unique not null,
  display_name           text not null,
  photo_url              text,
  description            text,
  preferred_language     text not null default 'en',
  default_landing_screen landing_screen not null default 'contacts',
  who_can_send_requests  privacy_scope not null default 'my_contacts',
  who_can_add_to_groups  privacy_scope not null default 'my_contacts',
  photo_visibility       privacy_scope not null default 'everyone',
  searchable_by_number   boolean not null default true,
  theme                  app_theme not null default 'system',
  notification_prefs     jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- contacts  (directional: owner_id classifies contact_id)
-- ---------------------------------------------------------------------------
create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  contact_id  uuid not null references public.profiles (id) on delete cascade,
  is_work     boolean not null default false,
  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  is_blocked  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, contact_id),
  check (owner_id <> contact_id)
);
create index contacts_owner_idx on public.contacts (owner_id);

-- ---------------------------------------------------------------------------
-- groups + membership + invitations
-- ---------------------------------------------------------------------------
create table public.groups (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  photo_url             text,
  description           text,
  created_by            uuid references public.profiles (id) on delete set null,
  members_can_add_tasks boolean not null default true,
  created_at            timestamptz not null default now()
);

create table public.group_members (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      group_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.group_invitations (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  invited_user  uuid not null references public.profiles (id) on delete cascade,
  invited_by    uuid references public.profiles (id) on delete set null,
  status        invitation_status not null default 'pending',
  created_at    timestamptz not null default now(),
  unique (group_id, invited_user)
);

-- ---------------------------------------------------------------------------
-- tasks  (1:1 and group). Personal checklist items are NOT tasks.
-- ---------------------------------------------------------------------------
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(title) between 1 and 60),
  note            text,
  status          task_status not null default 'pending_acceptance',
  priority        task_priority not null default 'normal',
  expected_period expected_period,
  due_date        timestamptz,               -- resolved from expected_period
  requester_id    uuid not null references public.profiles (id) on delete cascade,
  assignee_id     uuid references public.profiles (id) on delete cascade,
  group_id        uuid references public.groups (id) on delete cascade,
  reopen_reason   text,
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  completed_at    timestamptz,
  deleted_at      timestamptz,
  updated_at      timestamptz not null default now(),
  -- a task is either interpersonal (has an assignee) or attached to a group
  check (assignee_id is not null or group_id is not null)
);
create index tasks_requester_idx on public.tasks (requester_id);
create index tasks_assignee_idx  on public.tasks (assignee_id);
create index tasks_group_idx     on public.tasks (group_id);
create index tasks_due_idx       on public.tasks (due_date);

create table public.task_attachments (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks (id) on delete cascade,
  uploaded_by     uuid not null references public.profiles (id) on delete cascade,
  storage_path    text not null,
  attachment_type attachment_type not null,
  file_name       text,
  file_size       bigint,
  created_at      timestamptz not null default now()
);
create index task_attachments_task_idx on public.task_attachments (task_id);

-- append-only activity log (created / accepted / completed / reopened / poked …)
create table public.task_events (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  event_type text not null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index task_events_task_idx on public.task_events (task_id, created_at);

-- ---------------------------------------------------------------------------
-- messages  (ordinary chat for restricted contacts + message->task conversion)
-- ---------------------------------------------------------------------------
create table public.messages (
  id                uuid primary key default gen_random_uuid(),
  sender_id         uuid not null references public.profiles (id) on delete cascade,
  recipient_id      uuid not null references public.profiles (id) on delete cascade,
  body              text not null,
  converted_task_id uuid references public.tasks (id) on delete set null,
  created_at        timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index messages_pair_idx on public.messages (sender_id, recipient_id, created_at);

-- ---------------------------------------------------------------------------
-- personal checklists + items  (private to owner)
-- ---------------------------------------------------------------------------
create table public.checklists (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  title         text not null,
  kind          checklist_kind not null default 'custom',
  predefined_key text,                  -- e.g. 'daily','call','travel' for seeded lists
  behavior      checklist_behavior not null default 'normal',
  icon_color    text,                   -- hex; first letter of title used as glyph in UI
  is_hidden     boolean not null default false,
  last_reset_at timestamptz,
  created_at    timestamptz not null default now(),
  unique (owner_id, predefined_key)     -- one of each predefined list per user
);
create index checklists_owner_idx on public.checklists (owner_id);

create table public.checklist_items (
  id           uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists (id) on delete cascade,
  title        text not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  phone_number text,                    -- for 'call' behavior items
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index checklist_items_list_idx on public.checklist_items (checklist_id);

-- ---------------------------------------------------------------------------
-- pokes  (the "wand": nudges an assignee to the top of their screen)
-- ---------------------------------------------------------------------------
create table public.pokes (
  id                uuid primary key default gen_random_uuid(),
  from_user         uuid not null references public.profiles (id) on delete cascade,
  to_user           uuid not null references public.profiles (id) on delete cascade,
  task_id           uuid references public.tasks (id) on delete cascade,
  checklist_item_id uuid references public.checklist_items (id) on delete cascade,
  seen              boolean not null default false,
  created_at        timestamptz not null default now()
);
create index pokes_to_user_idx on public.pokes (to_user, created_at);

-- ============================================================================
-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
-- ============================================================================
create or replace function public.is_group_member(gid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = uid);
$$;

create or replace function public.is_group_admin(gid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = uid and role = 'administrator'
  );
$$;

create or replace function public.can_access_task(tid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.tasks t
    where t.id = tid
      and (
        t.requester_id = uid
        or t.assignee_id = uid
        or (t.group_id is not null and public.is_group_member(t.group_id, uid))
      )
  );
$$;

create or replace function public.owns_checklist(cid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.checklists where id = cid and owner_id = uid);
$$;

-- ============================================================================
-- Triggers
-- ============================================================================
-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch  before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger contacts_touch  before update on public.contacts
  for each row execute function public.touch_updated_at();
create trigger tasks_touch     before update on public.tasks
  for each row execute function public.touch_updated_at();

-- auto-create a profile row when a new auth user signs up.
-- display_name / phone are pulled from the signup metadata; adjust to taste.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, display_name)
  values (
    new.id,
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone', new.id::text),
    coalesce(new.raw_user_meta_data ->> 'display_name', 'New user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.profiles          enable row level security;
alter table public.contacts          enable row level security;
alter table public.groups            enable row level security;
alter table public.group_members     enable row level security;
alter table public.group_invitations enable row level security;
alter table public.tasks             enable row level security;
alter table public.task_attachments  enable row level security;
alter table public.task_events       enable row level security;
alter table public.messages          enable row level security;
alter table public.checklists        enable row level security;
alter table public.checklist_items   enable row level security;
alter table public.pokes             enable row level security;

-- ---- profiles ----
-- You can see your own profile, and profiles you're connected to (a contact
-- either direction, or a shared group). Discovery by phone number is handled by
-- a SECURITY DEFINER RPC, not by opening this table up to everyone.
create policy profiles_select_self_or_connected on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or exists (
      select 1 from public.contacts c
      where (c.owner_id = auth.uid() and c.contact_id = profiles.id)
         or (c.contact_id = auth.uid() and c.owner_id = profiles.id)
    )
    or exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = profiles.id
    )
  );
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---- contacts ---- (fully owned by owner_id)
create policy contacts_all_own on public.contacts
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---- groups ----
create policy groups_select_member on public.groups
  for select to authenticated using (public.is_group_member(id, auth.uid()));
create policy groups_insert_creator on public.groups
  for insert to authenticated with check (created_by = auth.uid());
create policy groups_update_admin on public.groups
  for update to authenticated using (public.is_group_admin(id, auth.uid()));
create policy groups_delete_admin on public.groups
  for delete to authenticated using (public.is_group_admin(id, auth.uid()));

-- ---- group_members ----
create policy group_members_select_same_group on public.group_members
  for select to authenticated using (public.is_group_member(group_id, auth.uid()));
create policy group_members_admin_manage on public.group_members
  for all to authenticated
  using (public.is_group_admin(group_id, auth.uid()))
  with check (public.is_group_admin(group_id, auth.uid()));

-- ---- group_invitations ----
create policy group_invitations_select on public.group_invitations
  for select to authenticated using (
    invited_user = auth.uid()
    or invited_by = auth.uid()
    or public.is_group_admin(group_id, auth.uid())
  );
create policy group_invitations_admin_create on public.group_invitations
  for insert to authenticated with check (public.is_group_admin(group_id, auth.uid()));
create policy group_invitations_invitee_respond on public.group_invitations
  for update to authenticated using (invited_user = auth.uid());

-- ---- tasks ----
create policy tasks_select_participant on public.tasks
  for select to authenticated using (
    requester_id = auth.uid()
    or assignee_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id, auth.uid()))
  );
create policy tasks_insert_requester on public.tasks
  for insert to authenticated with check (requester_id = auth.uid());
create policy tasks_update_participant on public.tasks
  for update to authenticated using (
    requester_id = auth.uid()
    or assignee_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id, auth.uid()))
  );

-- ---- task_attachments ----
create policy task_attachments_select on public.task_attachments
  for select to authenticated using (public.can_access_task(task_id, auth.uid()));
create policy task_attachments_insert on public.task_attachments
  for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_access_task(task_id, auth.uid()));
create policy task_attachments_delete_own on public.task_attachments
  for delete to authenticated using (uploaded_by = auth.uid());

-- ---- task_events ----
create policy task_events_select on public.task_events
  for select to authenticated using (public.can_access_task(task_id, auth.uid()));
create policy task_events_insert on public.task_events
  for insert to authenticated
  with check (actor_id = auth.uid() and public.can_access_task(task_id, auth.uid()));

-- ---- messages ----
create policy messages_select_participant on public.messages
  for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy messages_insert_sender on public.messages
  for insert to authenticated with check (sender_id = auth.uid());

-- ---- checklists / checklist_items ---- (private to owner)
create policy checklists_all_own on public.checklists
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy checklist_items_all_own on public.checklist_items
  for all to authenticated
  using (public.owns_checklist(checklist_id, auth.uid()))
  with check (public.owns_checklist(checklist_id, auth.uid()));

-- ---- pokes ----
create policy pokes_select_participant on public.pokes
  for select to authenticated using (from_user = auth.uid() or to_user = auth.uid());
create policy pokes_insert_sender on public.pokes
  for insert to authenticated with check (from_user = auth.uid());
create policy pokes_update_recipient on public.pokes
  for update to authenticated using (to_user = auth.uid());

-- ============================================================================
-- Storage buckets + policies
-- ============================================================================
insert into storage.buckets (id, name, public) values
  ('avatars',      'avatars',      true),
  ('group-photos', 'group-photos', true),
  ('attachments',  'attachments',  false)
on conflict (id) do nothing;

-- avatars / group-photos: public read, authenticated write.
-- storage.objects is a shared Supabase table, so guard against pre-existing policies.
drop policy if exists storage_public_read on storage.objects;
create policy storage_public_read on storage.objects
  for select using (bucket_id in ('avatars', 'group-photos'));

drop policy if exists storage_public_write on storage.objects;
create policy storage_public_write on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avatars', 'group-photos'));

-- attachments: private. MVP allows any authenticated user to read/write; tighten
-- later to task participants (e.g. encode task_id in the object path and check
-- can_access_task()).
drop policy if exists storage_attachments_rw on storage.objects;
create policy storage_attachments_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'attachments')
  with check (bucket_id = 'attachments');

-- ============================================================================
-- Realtime (so Contacts/task spaces update live like a chat app)
-- ============================================================================
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_events;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.checklist_items;
alter publication supabase_realtime add table public.pokes;
