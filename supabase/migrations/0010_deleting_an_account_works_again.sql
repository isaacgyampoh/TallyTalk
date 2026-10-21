-- ============================================================================
-- TaskTally — a deleted account can actually be deleted
-- Run after 0009_contact_requests_and_invitations.sql.
--
-- 0007 added a guard so a client may change `read_at` on a notification and
-- nothing else, which keeps the inbox a record of what happened rather than a
-- notepad. It was too strict by one case.
--
-- `notifications.actor_id` is `on delete set null`: when someone's account
-- goes, the notifications that mention them stay, with nobody attached. That
-- set-null is an UPDATE, so the guard rejected it — and because it ran inside
-- the delete, the whole delete failed:
--
--   DELETE /auth/v1/admin/users/<id>
--   -> 500 {"code":"P0001","message":"Only read_at may be changed on a notification"}
--
-- So deleting an account stopped working the day 0007 shipped, including the
-- right-to-erasure path in the delete-account function, which the Privacy
-- Policy promises. Nothing caught it because the only accounts deleted since
-- were test ones created before notifications existed.
--
-- The guard now permits exactly one more transition: actor_id going from
-- somebody to nobody, with every other column untouched. A client could make
-- that change to its own row, which costs only the tap-through on a
-- notification it already owns.
-- ============================================================================

create or replace function public.notifications_guard_fields()
returns trigger language plpgsql as $$
begin
  -- The foreign key clearing a departed account: actor_id alone, to null.
  if new.actor_id is null and old.actor_id is not null
     and new.user_id    is not distinct from old.user_id
     and new.category   is not distinct from old.category
     and new.title      is not distinct from old.title
     and new.body       is not distinct from old.body
     and new.task_id    is not distinct from old.task_id
     and new.group_id   is not distinct from old.group_id
     and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  if new.user_id    is distinct from old.user_id
     or new.category is distinct from old.category
     or new.title    is distinct from old.title
     or new.body     is distinct from old.body
     or new.task_id  is distinct from old.task_id
     or new.group_id is distinct from old.group_id
     or new.actor_id is distinct from old.actor_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Only read_at may be changed on a notification';
  end if;
  return new;
end
$$;
