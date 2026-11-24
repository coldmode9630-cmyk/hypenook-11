-- HypeNook: customer reviews table.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.

create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  product_id   text        not null check (char_length(product_id) between 1 and 80),
  name         text        not null check (char_length(name) between 2 and 60),
  rating       smallint    not null check (rating between 1 and 5),
  text         text        not null check (char_length(text) between 10 and 1000),
  status       text        not null default 'pending' check (status in ('pending', 'approved')),
  created_at   timestamptz not null default now(),
  -- optional extras collected by the review form
  title        text check (char_length(title) <= 80),
  city         text check (char_length(city) <= 40),
  size         text check (char_length(size) <= 4),
  order_number text check (char_length(order_number) <= 30),
  -- one-way hash of the sender's IP, used only for spam rate-limiting
  ip_hash      text
);

create index if not exists reviews_status_created_idx on public.reviews (status, created_at desc);
create index if not exists reviews_ip_hash_created_idx on public.reviews (ip_hash, created_at desc);

-- Row Level Security ON with NO policies: the public anon key can neither read
-- nor write this table. Only the website's server functions (using the secret
-- service-role key) can, and they only ever return approved reviews.
alter table public.reviews enable row level security;
revoke all on table public.reviews from anon, authenticated;
