create table if not exists public.public_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Little Fox',
  author_avatar text,
  body text not null check (char_length(trim(body)) between 1 and 1500),
  created_at timestamptz not null default now()
);

alter table public.public_posts
  add column if not exists author_avatar text;

alter table public.public_posts
  add column if not exists image_data text;

create table if not exists public.public_post_paws (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.public_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.public_posts enable row level security;
alter table public.public_post_paws enable row level security;

drop policy if exists public_posts_select_signed_in on public.public_posts;
create policy public_posts_select_signed_in on public.public_posts for select using (
  auth.uid() is not null
);

drop policy if exists public_posts_insert_own on public.public_posts;
create policy public_posts_insert_own on public.public_posts for insert with check (
  author_id = auth.uid()
);

drop policy if exists public_posts_delete_own on public.public_posts;
create policy public_posts_delete_own on public.public_posts for delete using (
  author_id = auth.uid()
);

drop policy if exists public_paws_select_signed_in on public.public_post_paws;
create policy public_paws_select_signed_in on public.public_post_paws for select using (
  auth.uid() is not null
);

drop policy if exists public_paws_insert_own on public.public_post_paws;
create policy public_paws_insert_own on public.public_post_paws for insert with check (
  user_id = auth.uid()
);

drop policy if exists public_paws_delete_own on public.public_post_paws;
create policy public_paws_delete_own on public.public_post_paws for delete using (
  user_id = auth.uid()
);
