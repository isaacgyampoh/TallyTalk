-- ============================================================================
-- TaskTally — sending a document to someone you are talking to
-- Run after 0011_private_messages.sql.
--
-- Sizes are chosen for the plan we are on, not for what browsers can upload.
-- Supabase Free gives 1 GB of storage and a few GB of egress a month. At 10 MB
-- a file that is roughly a hundred documents before storage alone is the
-- binding limit, which is the right order of magnitude for scanned invoices,
-- receipts and photographs — the things this app is for. It is deliberately
-- too small for video.
--
-- The limits are set on the bucket, so the storage service enforces them
-- before a byte reaches us: a client that lies about a file's type or size is
-- refused by the server, not by the upload form.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A private bucket for things sent in a conversation.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-files', 'message-files', false, 10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'text/plain'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = false;

-- The buckets that predate this had no limits at all: any size, any type,
-- including an executable renamed to .png. Same discipline, applied now.
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
 where id in ('avatars', 'group-photos');

update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
         'application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'text/csv', 'text/plain',
         'audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/aac'
       ]
 where id = 'attachments';

-- ---------------------------------------------------------------------------
-- What was sent, and with which message.
-- ---------------------------------------------------------------------------
create table public.message_attachments (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.messages (id) on delete cascade,
  uploaded_by  uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 3 and 400),
  file_name    text not null check (char_length(file_name) between 1 and 200),
  mime_type    text not null check (char_length(mime_type) <= 120),
  file_size    bigint not null check (file_size > 0 and file_size <= 10485760),
  created_at   timestamptz not null default now()
);

create index message_attachments_message_idx on public.message_attachments (message_id);

alter table public.message_attachments enable row level security;

/**
 * Can this person see that message?
 *
 * SECURITY DEFINER for the usual reason (0004): a storage policy reading
 * `messages` as the caller would be filtered by the caller's own RLS, which is
 * fine here — but the same helper is used from storage.objects, where the
 * caller cannot see public.messages at all.
 */
create or replace function public.can_access_message(mid uuid, uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.messages m
    where m.id = mid and (m.sender_id = uid or m.recipient_id = uid)
  );
$$;

-- Read what was sent in a conversation you are part of.
create policy message_attachments_select on public.message_attachments
  for select to authenticated
  using (public.can_access_message(message_id, auth.uid()));

-- Attach only to your own message, and only claim your own upload. Blocking is
-- already enforced on the message itself: there is no message to attach to.
create policy message_attachments_insert on public.message_attachments
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.sender_id = auth.uid()
    )
  );

-- Only the person who sent it may take it back.
create policy message_attachments_delete on public.message_attachments
  for delete to authenticated
  using (uploaded_by = auth.uid());

-- ---------------------------------------------------------------------------
-- The files themselves.
--
-- Path convention:  message-files/<uploader id>/<uuid>/<file name>
--
-- The uploader's own id leads, so writing is checkable before any row exists
-- to point at — the file is uploaded first and attached a moment later.
-- Reading is checked the other way: you may read a file some attachment row
-- points at, for a message you are part of. An orphan nobody has attached is
-- readable only by whoever uploaded it.
-- ---------------------------------------------------------------------------
drop policy if exists message_files_write on storage.objects;
create policy message_files_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists message_files_read on storage.objects;
create policy message_files_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'message-files'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.message_attachments a
        where a.storage_path = storage.objects.name
          and public.can_access_message(a.message_id, auth.uid())
      )
    )
  );

drop policy if exists message_files_delete on storage.objects;
create policy message_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'message-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- A message carrying only a file still says something in a notification.
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sender_name text;
begin
  select display_name into sender_name from public.profiles where id = new.sender_id;
  perform public.notify(
    new.recipient_id, 'messages',
    coalesce(sender_name, 'Someone') || ' sent you a message',
    -- Never the whole message, and never a file's contents: the first words,
    -- or a plain statement when the message is only an attachment.
    coalesce(nullif(left(new.body, 80), ''), 'Sent a file'),
    jsonb_build_object('contactId', new.sender_id, 'actorId', new.sender_id),
    'message:' || new.id
  );
  return new;
end
$$;
