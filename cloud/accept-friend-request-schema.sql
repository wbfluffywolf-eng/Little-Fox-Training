-- Little Fox Training Cloud v69 friend request accept helper.

create or replace function public.accept_friend_request(request_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  request_row record;
  personal_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in before accepting friends.';
  end if;

  select hm.*, h.owner_id as requester_id
  into request_row
  from public.household_members hm
  join public.households h on h.id = hm.household_id
  where hm.id = request_member_id
    and hm.user_id = current_user_id
    and hm.status = 'pending'
    and hm.role <> 'owner'
  limit 1;

  if request_row.id is null then
    raise exception 'Friend request was not found.';
  end if;

  select hm.household_id
  into personal_household_id
  from public.household_members hm
  join public.households h on h.id = hm.household_id
  where hm.user_id = current_user_id
    and hm.status = 'active'
    and (hm.role = 'owner' or h.owner_id = current_user_id)
  order by hm.created_at
  limit 1;

  if personal_household_id is null then
    raise exception 'Your personal tracker was not found.';
  end if;

  update public.household_members
  set status = 'active'
  where id = request_row.id
    and user_id = current_user_id;

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
    personal_household_id,
    request_row.requester_id,
    null,
    'viewer',
    'active',
    true,
    true,
    true,
    true,
    false,
    true,
    true,
    false,
    true,
    false
  )
  on conflict (household_id, user_id) do update
    set status = 'active',
        role = 'viewer',
        can_view_dashboard = true,
        can_view_calendar = true,
        can_view_inventory = true,
        can_view_trends = true,
        can_view_expenses = false,
        can_view_messages = true,
        can_send_messages = true,
        can_view_settings = false,
        can_suggest_diaper = true,
        can_add_logs = false;
end;
$$;

grant execute on function public.accept_friend_request(uuid) to authenticated;
