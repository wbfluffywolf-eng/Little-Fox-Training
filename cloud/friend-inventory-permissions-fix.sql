-- Run this in Supabase SQL Editor if older friend rows cannot see inventory
-- or cannot use diaper pings after accepting a friend request.
--
-- It only updates active friend/member rows. It does not change owner rows.

update public.household_members
set
  can_view_inventory = true,
  can_view_messages = true,
  can_send_messages = true,
  can_suggest_diaper = true
where status = 'active'
  and role <> 'owner';
