-- Little Fox Training: account access audit and repair
-- Run this in Supabase SQL Editor. It makes every auth account an active owner
-- of their own tracker, then returns any accounts that still need attention.

create extension if not exists pgcrypto;

create or replace function public.default_username(user_email text, user_id uuid)
returns text
language sql
immutable
as $$
  select left(
    case
      when length(base_name) >= 3 then base_name
      else 'user_' || left(replace(user_id::text, '-', ''), 8)
    end || '_' || left(replace(user_id::text, '-', ''), 6),
    24
  )
  from (
    select regexp_replace(
      regexp_replace(lower(coalesce(nullif(split_part(user_email, '@', 1), ''), 'user')), '[^a-z0-9_]+', '_', 'g'),
      '(^_+|_+$)',
      '',
      'g'
    ) as base_name
  ) cleaned;
$$;

insert into public.profiles (id, email, display_name, username)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data ->> 'display_name', split_part(coalesce(u.email, ''), '@', 1)),
  public.default_username(u.email, u.id)
from auth.users u
on conflict (id) do update
set email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    username = coalesce(public.profiles.username, excluded.username);

insert into public.households (owner_id, name)
select u.id, 'My Diaper Tracker'
from auth.users u
where not exists (
  select 1
  from public.households h
  where h.owner_id = u.id
);

with owner_households as (
  select distinct on (u.id)
    u.id as user_id,
    coalesce(u.email, '') as email,
    h.id as household_id
  from auth.users u
  join public.households h on h.owner_id = u.id
  order by u.id, h.created_at
)
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
select
  household_id,
  user_id,
  email,
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
from owner_households
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

select
  u.email,
  u.id as user_id,
  case when p.id is null then 'missing profile' else 'ok' end as profile_status,
  case when h.id is null then 'missing tracker' else 'ok' end as tracker_status,
  case
    when hm.id is null then 'missing owner membership'
    when hm.status <> 'active' then 'owner membership not active'
    when hm.role <> 'owner' then 'owner membership role is not owner'
    when not (
      hm.can_view_dashboard
      and hm.can_view_calendar
      and hm.can_view_inventory
      and hm.can_view_trends
      and hm.can_view_expenses
      and hm.can_view_messages
      and hm.can_send_messages
      and hm.can_view_settings
      and hm.can_suggest_diaper
      and hm.can_add_logs
    ) then 'owner permissions incomplete'
    else 'ok'
  end as owner_access_status
from auth.users u
left join public.profiles p on p.id = u.id
left join lateral (
  select *
  from public.households h
  where h.owner_id = u.id
  order by h.created_at
  limit 1
) h on true
left join public.household_members hm
  on hm.household_id = h.id
 and hm.user_id = u.id
order by u.created_at desc;
