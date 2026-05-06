-- Little Fox Training Cloud
-- Run this in Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Little Fox Training',
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invite_email text,
  role text not null check (role in ('owner', 'viewer', 'helper')) default 'viewer',
  status text not null check (status in ('pending', 'active', 'revoked')) default 'pending',
  can_view_dashboard boolean not null default true,
  can_view_calendar boolean not null default false,
  can_view_inventory boolean not null default false,
  can_view_trends boolean not null default false,
  can_view_expenses boolean not null default false,
  can_view_settings boolean not null default false,
  can_suggest_diaper boolean not null default true,
  can_add_logs boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, invite_email),
  unique (household_id, user_id)
);

create table if not exists public.diapers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  brand text not null,
  style text not null,
  size text,
  item_type text not null check (item_type in ('disposable', 'disposable_insert', 'cloth', 'cloth_insert', 'underpad')) default 'disposable',
  clean_count integer not null default 0,
  stock_count integer not null default 0,
  purchase_price numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  diaper_id uuid references public.diapers(id) on delete set null,
  event text not null check (event in ('wet', 'messed', 'dry')),
  happened_at timestamptz not null default now(),
  put_on_at timestamptz,
  day_night text not null default 'auto',
  leaked boolean not null default false,
  accident boolean not null default false,
  notes text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category text not null,
  brand text,
  item text not null,
  amount numeric(10,2) not null default 0,
  expense_date date not null default current_date,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.diaper_suggestions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  diaper_id uuid references public.diapers(id) on delete set null,
  suggested_by uuid not null references auth.users(id) on delete cascade,
  note text,
  status text not null check (status in ('new', 'accepted', 'dismissed')) default 'new',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.diapers enable row level security;
alter table public.logs enable row level security;
alter table public.expenses enable row level security;
alter table public.diaper_suggestions enable row level security;

create or replace function public.is_household_owner(target_household uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.households
    where id = target_household and owner_id = auth.uid()
  );
$$;

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
          when 'settings' then can_view_settings
          else false
        end
      )
  );
$$;

create or replace function public.can_suggest(target_household uuid)
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
      and (role = 'owner' or can_suggest_diaper)
  );
$$;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles for select using (id = auth.uid());
drop policy if exists profiles_upsert_self on public.profiles;
create policy profiles_upsert_self on public.profiles for insert with check (id = auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists households_select_member on public.households;
create policy households_select_member on public.households for select using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.household_members
    where household_id = households.id and user_id = auth.uid() and status = 'active'
  )
);
drop policy if exists households_insert_owner on public.households;
create policy households_insert_owner on public.households for insert with check (owner_id = auth.uid());
drop policy if exists households_update_owner on public.households;
create policy households_update_owner on public.households for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists members_select_related on public.household_members;
create policy members_select_related on public.household_members for select using (
  user_id = auth.uid() or public.is_household_owner(household_id)
);
drop policy if exists members_select_invite_by_email on public.household_members;
create policy members_select_invite_by_email on public.household_members for select using (
  user_id is null
  and status = 'pending'
  and lower(invite_email) = lower(auth.jwt() ->> 'email')
);
drop policy if exists members_insert_owner on public.household_members;
create policy members_insert_owner on public.household_members for insert with check (
  public.is_household_owner(household_id) or user_id = auth.uid()
);
drop policy if exists members_update_owner on public.household_members;
create policy members_update_owner on public.household_members for update using (
  public.is_household_owner(household_id) or user_id = auth.uid()
) with check (
  public.is_household_owner(household_id) or user_id = auth.uid()
);
drop policy if exists members_accept_invite_by_email on public.household_members;
create policy members_accept_invite_by_email on public.household_members for update using (
  user_id is null
  and status = 'pending'
  and lower(invite_email) = lower(auth.jwt() ->> 'email')
) with check (
  user_id = auth.uid()
  and status = 'active'
  and lower(invite_email) = lower(auth.jwt() ->> 'email')
);

drop policy if exists diapers_select_allowed on public.diapers;
create policy diapers_select_allowed on public.diapers for select using (
  public.can_view_household(household_id, 'inventory')
);
drop policy if exists diapers_write_owner on public.diapers;
create policy diapers_write_owner on public.diapers for all using (
  public.is_household_owner(household_id)
) with check (
  public.is_household_owner(household_id)
);

drop policy if exists logs_select_allowed on public.logs;
create policy logs_select_allowed on public.logs for select using (
  public.can_view_household(household_id, 'calendar')
  or public.can_view_household(household_id, 'trends')
  or public.is_household_owner(household_id)
);
drop policy if exists logs_insert_owner_or_helper on public.logs;
create policy logs_insert_owner_or_helper on public.logs for insert with check (
  public.is_household_owner(household_id)
  or exists (
    select 1 from public.household_members
    where household_id = logs.household_id
      and user_id = auth.uid()
      and status = 'active'
      and can_add_logs
  )
);
drop policy if exists logs_update_owner on public.logs;
create policy logs_update_owner on public.logs for update using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));
drop policy if exists logs_delete_owner on public.logs;
create policy logs_delete_owner on public.logs for delete using (public.is_household_owner(household_id));

drop policy if exists expenses_select_allowed on public.expenses;
create policy expenses_select_allowed on public.expenses for select using (
  public.can_view_household(household_id, 'expenses')
);
drop policy if exists expenses_write_owner on public.expenses;
create policy expenses_write_owner on public.expenses for all using (
  public.is_household_owner(household_id)
) with check (
  public.is_household_owner(household_id)
);

drop policy if exists suggestions_select_related on public.diaper_suggestions;
create policy suggestions_select_related on public.diaper_suggestions for select using (
  public.is_household_owner(household_id) or suggested_by = auth.uid()
);
drop policy if exists suggestions_insert_allowed on public.diaper_suggestions;
create policy suggestions_insert_allowed on public.diaper_suggestions for insert with check (
  suggested_by = auth.uid() and public.can_suggest(household_id)
);
drop policy if exists suggestions_update_owner on public.diaper_suggestions;
create policy suggestions_update_owner on public.diaper_suggestions for update using (
  public.is_household_owner(household_id)
) with check (
  public.is_household_owner(household_id)
);
