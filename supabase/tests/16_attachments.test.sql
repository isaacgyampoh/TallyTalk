-- ============================================================================
-- Files sent in a conversation (0012): who may upload, who may read, and what
-- the storage service refuses before a policy is even consulted.
-- ============================================================================
\set QUIET on
\pset pager off
set client_min_messages = notice;

select test.signup('+233300000001', 'Serwaa') as se \gset se_
select test.signup('+233300000002', 'Fiifi')  as fi \gset fi_
select test.signup('+233300000003', 'Aku')    as ak \gset ak_
\set serwaa :se_se
\set fiifi  :fi_fi
\set aku    :ak_ak

insert into public.contacts (owner_id, contact_id) values (:'serwaa', :'fiifi'), (:'fiifi', :'serwaa');
insert into public.messages (id, sender_id, recipient_id, body)
values ('aaaa1111-0000-0000-0000-00000000aaaa', :'serwaa', :'fiifi', 'The invoice');

-- ===========================================================================
-- What the bucket itself refuses, independently of any policy.
-- ===========================================================================
select test.ok(
  (select file_size_limit from storage.buckets where id = 'message-files') = 10485760,
  'the bucket caps a file at 10 MB, in the storage service rather than the form');
select test.ok(
  (select 'application/pdf' = any(allowed_mime_types) from storage.buckets where id = 'message-files'),
  'a PDF is allowed');
select test.ok(
  (select not ('application/x-msdownload' = any(allowed_mime_types))
     from storage.buckets where id = 'message-files'),
  'an executable is not, whatever it is renamed to');
select test.ok(
  (select file_size_limit from storage.buckets where id = 'avatars') = 5242880,
  'and the buckets that predate this now have limits too');
select test.ok(
  (select public from storage.buckets where id = 'message-files') = false,
  'the bucket is private — nothing in it is reachable by URL alone');

-- ===========================================================================
-- Uploading: your own folder, your own message.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'serwaa')::text, true);
select test.allows(
  format('insert into storage.objects (bucket_id, name, owner) values (''message-files'', %L, %L)',
         :'serwaa' || '/f1/invoice.pdf', :'serwaa'),
  'I can upload into my own folder');
select test.refuses(
  format('insert into storage.objects (bucket_id, name, owner) values (''message-files'', %L, %L)',
         :'fiifi' || '/f2/forged.pdf', :'serwaa'),
  'but not into somebody else''s');
select test.allows(
  format($$insert into public.message_attachments
           (message_id, uploaded_by, storage_path, file_name, mime_type, file_size)
           values ('aaaa1111-0000-0000-0000-00000000aaaa', %L, %L, 'invoice.pdf', 'application/pdf', 20000)$$,
         :'serwaa', :'serwaa' || '/f1/invoice.pdf'),
  'and attach it to my own message');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'fiifi')::text, true);
select test.refuses(
  format($$insert into public.message_attachments
           (message_id, uploaded_by, storage_path, file_name, mime_type, file_size)
           values ('aaaa1111-0000-0000-0000-00000000aaaa', %L, %L, 'theirs.pdf', 'application/pdf', 1000)$$,
         :'fiifi', :'fiifi' || '/f9/theirs.pdf'),
  'the recipient cannot attach a file to someone else''s message');
select test.refuses(
  format($$insert into public.message_attachments
           (message_id, uploaded_by, storage_path, file_name, mime_type, file_size)
           values ('aaaa1111-0000-0000-0000-00000000aaaa', %L, %L, 'spoof.pdf', 'application/pdf', 1000)$$,
         :'serwaa', :'fiifi' || '/f8/spoof.pdf'),
  'nor claim an upload as somebody else');
rollback;

-- ===========================================================================
-- Reading: the people in the conversation, and nobody else.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'fiifi')::text, true);
select test.sees('select 1 from public.message_attachments', 1,
  'the recipient can see what was sent to them');
select test.sees('select 1 from storage.objects where bucket_id = ''message-files''', 1,
  'and read the file itself');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'aku')::text, true);
select test.sees('select 1 from public.message_attachments', 0,
  'somebody outside the conversation sees no attachment');
select test.sees('select 1 from storage.objects where bucket_id = ''message-files''', 0,
  'and cannot reach the file, even knowing its path');
rollback;

-- ===========================================================================
-- An upload nobody has attached yet belongs to whoever uploaded it.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'serwaa')::text, true);
insert into storage.objects (bucket_id, name, owner)
values ('message-files', :'serwaa' || '/orphan/draft.pdf', :'serwaa');
select test.sees(format('select 1 from storage.objects where name = %L', :'serwaa' || '/orphan/draft.pdf'),
  1, 'I can still read a file I uploaded but have not attached');
select test.allows(
  format('delete from storage.objects where name = %L', :'serwaa' || '/orphan/draft.pdf'),
  'and clean it up myself');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'fiifi')::text, true);
select test.sees(format('select 1 from storage.objects where name = %L', :'serwaa' || '/orphan/draft.pdf'),
  0, 'nobody else can see an unattached upload');
rollback;

-- ===========================================================================
-- Blocking cannot be stepped around through attachments.
-- ===========================================================================
update public.contacts set is_blocked = true where owner_id = :'fiifi' and contact_id = :'serwaa';
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'serwaa')::text, true);
select test.refuses(
  format('insert into public.messages (sender_id, recipient_id, body) values (%L, %L, %L)',
         :'serwaa', :'fiifi', ''),
  'a blocked sender has no message to attach a file to in the first place');
rollback;
update public.contacts set is_blocked = false where owner_id = :'fiifi' and contact_id = :'serwaa';

-- ===========================================================================
-- Taking it back, and what a deleted message takes with it.
-- ===========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'fiifi')::text, true);
select test.ignores('delete from public.message_attachments',
  'the recipient cannot delete what was sent to them');
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'serwaa')::text, true);
select test.allows('delete from public.message_attachments',
  'the sender can take their own attachment back');
rollback;

delete from public.messages where id = 'aaaa1111-0000-0000-0000-00000000aaaa';
select test.sees('select 1 from public.message_attachments', 0,
  'and deleting the message takes its attachments with it');
