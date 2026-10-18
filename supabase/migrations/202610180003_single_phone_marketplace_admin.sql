drop policy if exists "Owners can create their own brick listings" on public.brick_listings;
drop policy if exists "Owners can update their own brick listings" on public.brick_listings;
revoke insert, update on public.brick_listings from authenticated;

revoke all on function public.save_my_brick_owner_details(
  text, text, text, uuid, text, text, integer, numeric
) from public, anon, authenticated;

create or replace function public.track_brick_listing_owner_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' then
      new.rate_updated_at := now();
      new.stock_updated_at := now();
    else
      if new.price_per_brick is distinct from old.price_per_brick then
        new.rate_updated_at := now();
      end if;
      if new.available_stock is distinct from old.available_stock then
        new.stock_updated_at := now();
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.track_brick_listing_owner_confirmation()
  from public, anon, authenticated;

drop trigger if exists brick_listing_owner_confirmation on public.brick_listings;
create trigger brick_listing_owner_confirmation
  before insert or update of available_stock, price_per_brick
  on public.brick_listings
  for each row execute function public.track_brick_listing_owner_confirmation();

do $$
declare
  selected_admin_id uuid;
begin
  select id into selected_admin_id
  from auth.users
  where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') in (
    '6309776185',
    '916309776185'
  )
  order by created_at desc
  limit 1;

  if selected_admin_id is null then
    raise exception 'No Bricks-Land account exists for phone number ending in 76185. Sign in with that number first, then retry this migration.';
  end if;

  delete from public.marketplace_admins
  where user_id <> selected_admin_id;

  insert into public.marketplace_admins (user_id)
  values (selected_admin_id)
  on conflict (user_id) do nothing;
end;
$$;
