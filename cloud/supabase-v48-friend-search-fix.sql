-- Little Fox Training Cloud v48 friend search and owner-channel fix.
-- Run this in the Supabase SQL Editor if friend search returns no accounts.

create or replace function public.search_profiles(search_text text)
returns table (
  id uuid,
  email text,
  display_name text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    coalesce(u.email, p.email, '') as email,
    coalesce(p.display_name, split_part(coalesce(u.email, p.email, ''), '@', 1)) as display_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where auth.uid() is not null
    and u.id <> auth.uid()
    and length(trim(search_text)) >= 2
    and (
      lower(coalesce(u.email, p.email, '')) like '%' || lower(trim(search_text)) || '%'
      or lower(coalesce(p.display_name, '')) like '%' || lower(trim(search_text)) || '%'
    )
  order by coalesce(u.email, p.email, '')
  limit 12;
$$;

grant execute on function public.search_profiles(text) to authenticated;

do $$
declare
  existing_user record;
  tracker_id uuid;
begin
  for existing_user in
    select id, email, raw_user_meta_data from auth.users
  loop
    insert into public.profiles (id, email, display_name)
    values (
      existing_user.id,
      coalesce(existing_user.email, ''),
      coalesce(existing_user.raw_user_meta_data ->> 'display_name', split_part(coalesce(existing_user.email, ''), '@', 1))
    )
    on conflict (id) do update
      set email = excluded.email,
          display_name = coalesce(public.profiles.display_name, excluded.display_name);

    select id into tracker_id
    from public.households
    where owner_id = existing_user.id
    order by created_at
    limit 1;

    if tracker_id is null then
      insert into public.households (owner_id, name)
      values (existing_user.id, 'My Diaper Tracker')
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
      existing_user.id,
      coalesce(existing_user.email, ''),
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
  end loop;
end $$;
