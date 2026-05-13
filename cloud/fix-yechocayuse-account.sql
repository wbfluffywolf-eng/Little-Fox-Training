-- Targeted repair for yechocayuse@gmail.com.
-- Run this in the Supabase SQL Editor.
-- It creates/repairs the profile row and makes the user owner of their own tracker.

do $$
declare
  target_user record;
  tracker_id uuid;
begin
  select id, email, raw_user_meta_data
  into target_user
  from auth.users
  where lower(email) = lower('yechocayuse@gmail.com')
  order by created_at desc
  limit 1;

  if target_user.id is null then
    raise exception 'No Supabase auth user found for yechocayuse@gmail.com';
  end if;

  insert into public.profiles (id, email, display_name)
  values (
    target_user.id,
    coalesce(target_user.email, 'yechocayuse@gmail.com'),
    coalesce(target_user.raw_user_meta_data ->> 'display_name', split_part(coalesce(target_user.email, 'yechocayuse@gmail.com'), '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name);

  select id into tracker_id
  from public.households
  where owner_id = target_user.id
  order by created_at
  limit 1;

  if tracker_id is null then
    insert into public.households (owner_id, name)
    values (target_user.id, 'My Diaper Tracker')
    returning id into tracker_id;
  end if;

  insert into public.household_members (
    household_id,
    user_id,
    invite_email,
    role,
    status,
    can_view_dashboard,
    can_view_calendar,
    can_view_inventory,
    can_view_trends,
    can_view_expenses,
    can_view_messages,
    can_send_messages,
    can_view_settings,
    can_suggest_diaper,
    can_add_logs
  )
  values (
    tracker_id,
    target_user.id,
    coalesce(target_user.email, 'yechocayuse@gmail.com'),
    'owner',
    'active',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true
  )
  on conflict (household_id, user_id) do update
    set role = 'owner',
        status = 'active',
        can_view_dashboard = true,
        can_view_calendar = true,
        can_view_inventory = true,
        can_view_trends = true,
        can_view_expenses = true,
        can_view_messages = true,
        can_send_messages = true,
        can_view_settings = true,
        can_suggest_diaper = true,
        can_add_logs = true;

  raise notice 'Fixed account %, user id %, tracker %', target_user.email, target_user.id, tracker_id;
end $$;
