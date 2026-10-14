create or replace function public.save_my_brick_owner_details(
  p_display_name_en text,
  p_display_name_te text,
  p_location text,
  p_listing_id uuid,
  p_listing_name text,
  p_brick_type text,
  p_available_stock integer,
  p_price_per_brick numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_owner public.brick_owners%rowtype;
  saved_listing_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in with a linked brick owner account to update these details.';
  end if;

  if coalesce(length(trim(p_display_name_en)), 0) not between 2 and 120
    or coalesce(length(trim(p_display_name_te)), 0) not between 2 and 120
    or coalesce(length(trim(p_location)), 0) not between 2 and 200 then
    raise exception 'Enter valid owner names and a location.';
  end if;
  if coalesce(length(trim(p_listing_name)), 0) not between 2 and 120
    or coalesce(length(trim(p_brick_type)), 0) > 120
    or p_available_stock is null or p_available_stock < 0
    or p_price_per_brick is null or p_price_per_brick <= 0 then
    raise exception 'Enter a valid brick name, stock quantity, and price.';
  end if;

  select * into selected_owner
  from public.brick_owners
  where auth_user_id = (select auth.uid()) and is_active
  for update;

  if not found then
    raise exception 'This account is not linked to an active brick owner profile.';
  end if;

  update public.brick_owners
  set display_name_en = trim(p_display_name_en),
      display_name_te = trim(p_display_name_te),
      location = trim(p_location)
  where id = selected_owner.id;

  if p_listing_id is null then
    insert into public.brick_listings (
      owner_id, name, brick_type, available_stock, price_per_brick, is_active, updated_at
    )
    values (
      selected_owner.id, trim(p_listing_name), coalesce(trim(p_brick_type), ''),
      p_available_stock, p_price_per_brick, true, now()
    )
    returning id into saved_listing_id;
  else
    update public.brick_listings
    set name = trim(p_listing_name),
        brick_type = coalesce(trim(p_brick_type), ''),
        available_stock = p_available_stock,
        price_per_brick = p_price_per_brick,
        updated_at = now()
    where id = p_listing_id and owner_id = selected_owner.id
    returning id into saved_listing_id;

    if not found then
      raise exception 'The selected brick listing does not belong to this owner.';
    end if;
  end if;

  return saved_listing_id;
end;
$$;

revoke all on function public.save_my_brick_owner_details(text, text, text, uuid, text, text, integer, numeric)
  from public, anon;
grant execute on function public.save_my_brick_owner_details(text, text, text, uuid, text, text, integer, numeric)
  to authenticated;
