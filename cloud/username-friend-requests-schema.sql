-- Little Fox Training Cloud v68 usernames and friend-request alerts.
-- Run this in Supabase SQL Editor if the app says username search needs setup.

alter table public.profiles
  add column if not exists username text;

update public.profiles
set username = left(
  regexp_replace(
    regexp_replace(lower(coalesce(nullif(display_name, ''), split_part(email, '@', 1), 'user')), '[^a-z0-9_]+', '_', 'g'),
    '(^_+|_+$)',
    '',
    'g'
  ) || '_' || left(replace(id::text, '-', ''), 6),
  24
)
where username is null or username = '';

alter table public.profiles
  alter column username set not null;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$');

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

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

drop function if exists public.search_profiles(text);
create or replace function public.search_profiles(search_text text)
returns table (
  id uuid,
  email text,
  display_name text,
  username text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    coalesce(p.username, public.default_username(u.email, u.id)) as email,
    coalesce(p.display_name, p.username, split_part(coalesce(u.email, p.email, ''), '@', 1)) as display_name,
    coalesce(p.username, public.default_username(u.email, u.id)) as username
  from auth.users u
  left join public.profiles p on p.id = u.id
  where auth.uid() is not null
    and u.id <> auth.uid()
    and length(trim(search_text)) >= 2
    and (
      lower(coalesce(p.username, '')) like '%' || lower(trim(search_text)) || '%'
      or lower(coalesce(p.display_name, '')) like '%' || lower(trim(search_text)) || '%'
    )
  order by coalesce(p.username, p.display_name, '')
  limit 12;
$$;

grant execute on function public.search_profiles(text) to authenticated;
