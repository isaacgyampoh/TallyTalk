-- ============================================================================
-- TaskTally — a number found is a number typed
-- Run after 0007_notifications_without_firebase.sql.
--
-- Nobody could add a contact. The first real account made it visible:
--
--   GoTrue stores   auth.users.phone = '233533547740'   (E.164, no plus)
--   handle_new_user copies that into profiles.phone
--   the app asks    find_profile_by_phone('+233533547740')
--   the policy says p.phone = phone_number  ->  never true
--
-- So every lookup answered "no such person", which is indistinguishable from a
-- number that has not signed up — the ambiguity the function was designed to
-- have, working against us.
--
-- The database tests did not catch it because the test helper stored the phone
-- with a leading "+", which GoTrue does not. That helper now stores what the
-- real thing stores, and the assertions below it search the way the app does.
--
-- Comparing digits rather than strings also absorbs the other shapes a number
-- arrives in: spaces, brackets, a leading zero stripped on the client.
-- ============================================================================

/** The comparable form of a phone number: its digits, nothing else. */
create or replace function public.digits_only(value text)
returns text language sql immutable parallel safe as $$
  select regexp_replace(coalesce(value, ''), '\D', '', 'g')
$$;

comment on function public.digits_only(text) is
  'Phone numbers are compared by digits so +233…, 233… and "233 24 …" all match.';

create or replace function public.find_profile_by_phone(phone_number text)
returns table (id uuid, display_name text, photo_url text)
language sql security definer stable set search_path = public as $$
  select
    p.id,
    p.display_name,
    case when p.photo_visibility = 'nobody' then null else p.photo_url end
  from public.profiles p
  where public.digits_only(p.phone) = public.digits_only(phone_number)
    and public.digits_only(phone_number) <> ''
    and p.searchable_by_number
    and p.id <> auth.uid()
    -- has_blocked is SECURITY DEFINER for the reason 0004 explains: the row
    -- that does the blocking belongs to the blocker, and the caller cannot see
    -- it, so an inline sub-select here would always find nothing.
    and not public.has_blocked(p.id, auth.uid())
  limit 1;
$$;

revoke all on function public.find_profile_by_phone(text) from public, anon;
grant execute on function public.find_profile_by_phone(text) to authenticated;

-- Without this the lookup is a sequential scan with a function call per row.
-- It stays fast as the user base grows, and it is the only index that matches
-- how the column is actually queried.
create index if not exists profiles_phone_digits_idx
  on public.profiles (public.digits_only(phone));
