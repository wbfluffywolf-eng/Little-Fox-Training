alter table public.household_members
  add column if not exists can_view_messages boolean not null default true,
  add column if not exists can_send_messages boolean not null default true;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  diaper_id uuid references public.diapers(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.messages
  add column if not exists recipient_id uuid references auth.users(id) on delete cascade;

alter table public.messages
  add column if not exists image_data text;

alter table public.messages enable row level security;

create or replace function public.can_view_household(target_household uuid, permission_key text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household
      and user_id = auth.uid()
      and status = 'active'
      and (
        role = 'owner'
        or case permission_key
          when 'dashboard' then can_view_dashboard
          when 'calendar' then can_view_calendar
          when 'inventory' then can_view_inventory
          when 'trends' then can_view_trends
          when 'expenses' then can_view_expenses
          when 'messages' then can_view_messages
          when 'settings' then can_view_settings
          else false
        end
      )
  );
$$;

create or replace function public.can_send_message(target_household uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household
      and user_id = auth.uid()
      and status = 'active'
      and (role = 'owner' or can_send_messages)
  );
$$;

drop policy if exists messages_select_allowed on public.messages;
create policy messages_select_allowed on public.messages for select using (
  public.can_view_household(household_id, 'messages')
  and (
    recipient_id is null
    or recipient_id = auth.uid()
    or sender_id = auth.uid()
    or public.is_household_owner(household_id)
  )
);

drop policy if exists messages_insert_allowed on public.messages;
create policy messages_insert_allowed on public.messages for insert with check (
  sender_id = auth.uid()
  and public.can_send_message(household_id)
  and (
    recipient_id is null
    or exists (
      select 1
      from public.household_members
      where household_id = messages.household_id
        and user_id = recipient_id
        and status = 'active'
    )
  )
);

drop policy if exists messages_update_owner on public.messages;
create policy messages_update_owner on public.messages for update using (
  public.is_household_owner(household_id)
) with check (
  public.is_household_owner(household_id)
);

drop policy if exists messages_delete_owner on public.messages;
create policy messages_delete_owner on public.messages for delete using (
  public.is_household_owner(household_id)
);
