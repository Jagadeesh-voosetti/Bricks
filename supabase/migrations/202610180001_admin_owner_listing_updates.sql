drop function if exists public.admin_save_brick_owner_listing(
  text, text, text, text, text, text, integer, numeric
);

create or replace function public.admin_save_brick_owner_listing(
  p_owner_id text,
  p_listing_id uuid,
  p_display_name_en text,
  p_display_name_te text,
  p_location text,
  p_listing_name text,
  p_brick_type text,
  p_available_stock integer,
  p_price_per_brick numeric
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_owner_id text;
begin
  if (select auth.uid()) is null or not exists (
    select 1
    from public.marketplace_admins as admin
    where admin.user_id = (select auth.uid())
  ) then
    raise exception 'This account is not authorized to manage marketplace owners.';
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

  if p_owner_id is null then
    if p_listing_id is not null then
      raise exception 'A listing can only be updated for an existing owner.';
    end if;
    saved_owner_id := coalesce(
      nullif(trim(both '-' from regexp_replace(lower(trim(p_display_name_en)), '[^a-z0-9]+', '-', 'g')), ''),
      'owner'
    ) || '-' || substr(gen_random_uuid()::text, 1, 8);

    insert into public.brick_owners (
      id, display_name_en, display_name_te, location, is_active
    )
    values (
      saved_owner_id, trim(p_display_name_en), trim(p_display_name_te), trim(p_location), true
    );
  else
    update public.brick_owners
    set display_name_en = trim(p_display_name_en),
        display_name_te = trim(p_display_name_te),
        location = trim(p_location),
        is_active = true
    where id = p_owner_id
    returning id into saved_owner_id;

    if not found then
      raise exception 'The selected owner profile was not found.';
    end if;
  end if;

  if p_listing_id is null then
    insert into public.brick_listings (
      owner_id, name, brick_type, available_stock, price_per_brick, is_active, updated_at
    )
    values (
      saved_owner_id, trim(p_listing_name), coalesce(trim(p_brick_type), ''),
      p_available_stock, p_price_per_brick, true, now()
    );
  else
    update public.brick_listings
    set name = trim(p_listing_name),
        brick_type = coalesce(trim(p_brick_type), ''),
        available_stock = p_available_stock,
        price_per_brick = p_price_per_brick,
        is_active = true,
        updated_at = now()
    where id = p_listing_id and owner_id = saved_owner_id;

    if not found then
      raise exception 'The selected brick listing does not belong to this owner.';
    end if;
  end if;

  return saved_owner_id;
end;
$$;

revoke all on function public.admin_save_brick_owner_listing(
  text, uuid, text, text, text, text, text, integer, numeric
) from public, anon;
grant execute on function public.admin_save_brick_owner_listing(
  text, uuid, text, text, text, text, text, integer, numeric
) to authenticated;
