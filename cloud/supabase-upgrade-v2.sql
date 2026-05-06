-- Little Fox Training Cloud upgrade v2
-- Run this once in Supabase SQL Editor if your project was created before the full cloud log update.

alter table public.logs add column if not exists insert_ids uuid[] not null default '{}';
alter table public.logs add column if not exists changed_at timestamptz;
alter table public.logs add column if not exists subcategory text;
