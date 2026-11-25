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

-- The website's server functions use the service_role (secret) key.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.reviews to service_role;

-- ============================================================
-- Review photos (added later; safe to run on an existing table)
-- ============================================================

-- Up to 3 photo paths per review, e.g. {"<review-id>/1-a1b2c3.webp"}
alter table public.reviews add column if not exists photos text[] not null default '{}';
do $$ begin
  alter table public.reviews add constraint reviews_photos_max3 check (cardinality(photos) <= 3);
exception when duplicate_object then null; end $$;

-- PRIVATE bucket: only JPG / PNG / WEBP, max 5 MB per file (enforced by Supabase Storage itself).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No storage policies are added on purpose: visitors (anon) can't list, read or
-- upload anything in this bucket directly. The server (service_role, which
-- bypasses RLS) hands out one-time signed upload URLs only after a valid review
-- is saved, and signed view links only for approved reviews (and for the admin).
