alter table public.messages
  add column if not exists image_data text;

alter table public.public_posts
  add column if not exists image_data text;
