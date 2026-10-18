alter table public.brick_listings
  add column if not exists rate_updated_at timestamptz default now(),
  add column if not exists stock_updated_at timestamptz default now();

update public.brick_listings
set rate_updated_at = null,
    stock_updated_at = null;

create or replace function public.brick_marketplace_daily_cutoff()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (
    date_trunc('day', now() at time zone 'Asia/Kolkata')
    + case
        when (now() at time zone 'Asia/Kolkata')::time < time '06:00'
          then interval '-18 hours'
        else interval '6 hours'
      end
  ) at time zone 'Asia/Kolkata';
$$;

revoke all on function public.brick_marketplace_daily_cutoff()
  from public, anon, authenticated;

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
    or coalesce(length(trim(p_brick_type)), 0) not between 2 and 120
    or p_available_stock is null or p_available_stock < 0
    or p_price_per_brick is null or p_price_per_brick <= 0 then
    raise exception 'Enter a valid brick type, stock quantity, and price.';
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
      owner_id, name, brick_type, available_stock, price_per_brick,
      is_active, updated_at, rate_updated_at, stock_updated_at
    )
    values (
      selected_owner.id, trim(p_listing_name), trim(p_brick_type),
      p_available_stock, p_price_per_brick, true, now(), now(), now()
    )
    returning id into saved_listing_id;
  else
    update public.brick_listings
    set name = trim(p_listing_name),
        brick_type = trim(p_brick_type),
        available_stock = p_available_stock,
        price_per_brick = p_price_per_brick,
        updated_at = now(),
        rate_updated_at = now(),
        stock_updated_at = now()
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
    or coalesce(length(trim(p_brick_type)), 0) not between 2 and 120
    or p_available_stock is null or p_available_stock < 0
    or p_price_per_brick is null or p_price_per_brick <= 0 then
    raise exception 'Enter a valid brick type, stock quantity, and price.';
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
      owner_id, name, brick_type, available_stock, price_per_brick,
      is_active, updated_at, rate_updated_at, stock_updated_at
    )
    values (
      saved_owner_id, trim(p_listing_name), trim(p_brick_type),
      p_available_stock, p_price_per_brick, true, now(), now(), now()
    );
  else
    update public.brick_listings
    set name = trim(p_listing_name),
        brick_type = trim(p_brick_type),
        available_stock = p_available_stock,
        price_per_brick = p_price_per_brick,
        is_active = true,
        updated_at = now(),
        rate_updated_at = now(),
        stock_updated_at = now()
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

create or replace function public.reserve_brick_order(
  p_customer_id uuid,
  p_listing_id uuid,
  p_quantity integer,
  p_delivery_note text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_delivery_address text,
  p_delivery_date date,
  p_transport_option text,
  p_payment_method text
)
returns table (
  order_id uuid,
  owner_id text,
  listing_name text,
  unit_price numeric,
  total_amount numeric,
  advance_amount numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_listing public.brick_listings%rowtype;
  reserved_order_id uuid;
  order_total numeric(14, 2);
begin
  perform public.release_expired_brick_orders();

  if p_quantity < 100 or p_quantity > 1000000 then
    raise exception 'Enter a quantity between 100 and 1,000,000 bricks.';
  end if;
  if coalesce(length(trim(p_delivery_address)), 0) < 8 or length(trim(p_delivery_address)) > 400 then
    raise exception 'Enter a complete delivery address (8–400 characters).';
  end if;
  if p_delivery_date is null or p_delivery_date < current_date then
    raise exception 'Choose a valid delivery date.';
  end if;
  if p_transport_option not in ('self_pickup', 'tractor', 'mini_truck', 'lorry') then
    raise exception 'Choose a valid transport option.';
  end if;
  if p_payment_method not in ('online', 'offline') then
    raise exception 'Choose a valid payment method.';
  end if;

  select * into selected_listing
  from public.brick_listings
  where id = p_listing_id and is_active
  for update;

  if not found then
    raise exception 'This brick listing is no longer available.';
  end if;
  if selected_listing.rate_updated_at is null
    or selected_listing.rate_updated_at < public.brick_marketplace_daily_cutoff()
    or selected_listing.stock_updated_at is null
    or selected_listing.stock_updated_at < public.brick_marketplace_daily_cutoff() then
    raise exception 'This listing has not been updated since 6:00 AM today. Please contact the owner.';
  end if;
  if selected_listing.price_per_brick <= 0 then
    raise exception 'This listing does not have a valid price.';
  end if;
  if selected_listing.available_stock < p_quantity then
    raise exception 'There is not enough stock for this quantity.';
  end if;

  order_total := selected_listing.price_per_brick * p_quantity;
  if order_total < 1000 then
    raise exception 'The brick order total must be at least ₹1,000 to collect the required advance.';
  end if;

  update public.brick_listings
  set available_stock = available_stock - p_quantity,
      stock_updated_at = now(),
      updated_at = now()
  where id = selected_listing.id;

  insert into public.brick_orders (
    customer_id, customer_name, customer_phone, customer_email, listing_id, owner_id,
    quantity, unit_price, total_amount, delivery_note, delivery_address, delivery_date,
    transport_option, transport_amount, payment_method, advance_amount, status, expires_at
  )
  values (
    p_customer_id,
    left(coalesce(p_customer_name, ''), 120),
    left(coalesce(p_customer_phone, ''), 20),
    left(coalesce(p_customer_email, ''), 254),
    selected_listing.id,
    selected_listing.owner_id,
    p_quantity,
    selected_listing.price_per_brick,
    order_total,
    left(coalesce(p_delivery_note, ''), 1000),
    left(trim(p_delivery_address), 400),
    p_delivery_date,
    p_transport_option,
    0,
    p_payment_method,
    1000,
    case when p_payment_method = 'offline' then 'offline_pending' else 'payment_pending' end,
    case when p_payment_method = 'offline' then now() + interval '7 days' else now() + interval '15 minutes' end
  )
  returning id into reserved_order_id;

  return query
  select reserved_order_id,
         selected_listing.owner_id,
         selected_listing.name,
         selected_listing.price_per_brick,
         order_total,
         1000::numeric;
end;
$$;

revoke all on function public.reserve_brick_order(
  uuid, uuid, integer, text, text, text, text, text, date, text, text
) from public, anon, authenticated;
grant execute on function public.reserve_brick_order(
  uuid, uuid, integer, text, text, text, text, text, date, text, text
) to service_role;
