alter table public.brick_orders
  add column if not exists delivery_address text not null default '',
  add column if not exists delivery_date date,
  add column if not exists transport_option text not null default 'delivery',
  add column if not exists transport_amount numeric(14, 2) not null default 0,
  add column if not exists payment_method text not null default 'online',
  add column if not exists advance_amount numeric(14, 2) not null default 1000,
  add column if not exists amount_paid numeric(14, 2) not null default 0;

alter table public.brick_orders
  drop constraint if exists brick_orders_status_check;

update public.brick_orders
set transport_option = 'tractor'
where transport_option not in ('self_pickup', 'tractor', 'mini_truck', 'lorry');

update public.brick_orders
set amount_paid = total_amount
where status in ('paid', 'loading', 'dispatched', 'delivered')
  and amount_paid = 0;

alter table public.brick_orders
  add constraint brick_orders_status_check
    check (status in (
      'payment_pending', 'offline_pending', 'paid', 'loading', 'dispatched',
      'delivered', 'payment_failed', 'refund_pending', 'refunded'
    )),
  add constraint brick_orders_payment_method_check
    check (payment_method in ('online', 'offline')),
  add constraint brick_orders_transport_option_check
    check (transport_option in ('self_pickup', 'tractor', 'mini_truck', 'lorry')),
  add constraint brick_orders_advance_amount_check
    check (advance_amount = 1000),
  add constraint brick_orders_amount_paid_check
    check (amount_paid >= 0 and amount_paid <= total_amount);

drop function if exists public.reserve_brick_order(uuid, uuid, integer, text, text, text, text);

create function public.reserve_brick_order(
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

create or replace function public.release_expired_brick_orders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_order record;
begin
  for expired_order in
    select id, listing_id, quantity
    from public.brick_orders
    where status in ('payment_pending', 'offline_pending') and expires_at <= now()
    for update skip locked
  loop
    update public.brick_listings
    set available_stock = available_stock + expired_order.quantity,
        updated_at = now()
    where id = expired_order.listing_id;

    update public.brick_orders
    set status = 'payment_failed', updated_at = now()
    where id = expired_order.id;
  end loop;
end;
$$;

create or replace function public.confirm_brick_payment(
  p_order_id uuid,
  p_customer_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text
)
returns table (invoice_number text, total_amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.brick_orders%rowtype;
  next_invoice text;
begin
  select * into selected_order
  from public.brick_orders
  where id = p_order_id and customer_id = p_customer_id
  for update;

  if not found or selected_order.razorpay_order_id <> p_razorpay_order_id then
    raise exception 'Payment order does not match.';
  end if;
  if selected_order.payment_method <> 'online' then
    raise exception 'This order is not an online payment.';
  end if;
  if selected_order.status = 'paid' then
    if selected_order.razorpay_payment_id <> p_razorpay_payment_id then
      raise exception 'A different payment was already recorded for this order.';
    end if;
    return query select selected_order.invoice_number, selected_order.total_amount;
    return;
  end if;
  if selected_order.status <> 'payment_pending' or selected_order.expires_at <= now() then
    raise exception 'Payment window expired. Any captured payment will be refunded.';
  end if;

  next_invoice := 'BL-' || to_char(now(), 'YYYYMM') || '-' ||
    lpad(nextval('public.brick_invoice_number_seq')::text, 6, '0');

  update public.brick_orders
  set status = 'paid',
      razorpay_payment_id = p_razorpay_payment_id,
      invoice_number = next_invoice,
      amount_paid = advance_amount,
      paid_at = now(),
      updated_at = now()
  where id = selected_order.id;

  return query select next_invoice, selected_order.total_amount;
end;
$$;

create or replace function public.confirm_offline_brick_advance(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.brick_orders%rowtype;
  next_invoice text;
begin
  select * into selected_order
  from public.brick_orders
  where id = p_order_id
  for update;

  if not found or not exists (
    select 1
    from public.brick_owners
    where id = selected_order.owner_id
      and auth_user_id = (select auth.uid())
      and is_active
  ) then
    raise exception 'You are not allowed to verify this order.';
  end if;
  if selected_order.payment_method <> 'offline' or selected_order.status <> 'offline_pending' then
    raise exception 'This offline order is not awaiting advance verification.';
  end if;
  if selected_order.expires_at <= now() then
    raise exception 'This order reservation expired and cannot be confirmed.';
  end if;

  next_invoice := 'BL-' || to_char(now(), 'YYYYMM') || '-' ||
    lpad(nextval('public.brick_invoice_number_seq')::text, 6, '0');
  update public.brick_orders
  set status = 'paid',
      invoice_number = next_invoice,
      amount_paid = advance_amount,
      paid_at = now(),
      updated_at = now()
  where id = selected_order.id;

  return next_invoice;
end;
$$;

grant select (
  delivery_address, delivery_date, transport_option, transport_amount,
  payment_method, advance_amount, amount_paid
) on public.brick_orders to authenticated;

revoke all on function public.reserve_brick_order(uuid, uuid, integer, text, text, text, text, text, date, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_brick_order(uuid, uuid, integer, text, text, text, text, text, date, text, text)
  to service_role;

revoke all on function public.confirm_offline_brick_advance(uuid) from public, anon;
grant execute on function public.confirm_offline_brick_advance(uuid) to authenticated;
