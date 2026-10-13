alter table public.brick_listings
  add column if not exists source_submission_key text;

create unique index if not exists brick_listings_source_submission_key_uidx
  on public.brick_listings (source_submission_key);
