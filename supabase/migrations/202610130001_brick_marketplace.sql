create table if not exists public.brick_owners (
  id text primary key,
  display_name_en text not null,
  display_name_te text not null,
  location text not null default '',
  auth_user_id uuid unique references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.brick_owners (id, display_name_en, display_name_te)
values
  ('usetti-simhachalam', 'Usetti Simhachalam', 'ఉసెట్టి సింహాచలం'),
  ('usetti-thrinath', 'Usetti Thrinath', 'ఉసెట్టి త్రినాథ్'),
  ('rayala-sambhamurthy', 'Rayala Sambhamurthy', 'రాయల సాంబమూర్తి'),
  ('rayala-srinu', 'Rayala Srinu', 'రాయల శ్రీను'),
  ('usetti-gangarao', 'Usetti Gangarao', 'ఉసెట్టి గంగారావు'),
  ('teppalavalasa-sombhabu', 'Teppalavalasa Sombhabu', 'తెప్పలవలస సోంబాబు'),
  ('anakapalli-paradesh', 'Anakapalli Paradesh', 'అనకాపల్లి పరదేశు')
on conflict (id) do update
set display_name_en = excluded.display_name_en,
    display_name_te = excluded.display_name_te;

create table if not exists public.brick_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.brick_owners(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 120),
  brick_type text not null default '',
  available_stock integer not null default 0 check (available_stock >= 0),
  price_per_brick numeric(12, 2) not null check (price_per_brick > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brick_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete restrict,
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  listing_id uuid not null references public.brick_listings(id) on delete restrict,
  owner_id text not null references public.brick_owners(id) on delete restrict,
  quantity integer not null check (quantity >= 100),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  total_amount numeric(14, 2) not null check (total_amount >= 0),
  status text not null default 'payment_pending'
    check (status in ('payment_pending', 'paid', 'loading', 'dispatched', 'delivered', 'payment_failed', 'refund_pending', 'refunded')),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  invoice_number text unique,
  delivery_note text not null default '',
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.brick_invoice_number_seq;

create index if not exists brick_listings_owner_active_idx
  on public.brick_listings (owner_id, is_active);
create index if not exists brick_orders_customer_created_idx
  on public.brick_orders (customer_id, created_at desc);
create index if not exists brick_orders_owner_status_idx
  on public.brick_orders (owner_id, status, created_at desc);

alter table public.brick_owners enable row level security;
alter table public.brick_listings enable row level security;
alter table public.brick_orders enable row level security;

create or replace function public.is_brick_owner(p_owner_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.brick_owners as owner
    where owner.id = p_owner_id
      and owner.auth_user_id = (select auth.uid())
      and owner.is_active
  );
$$;

drop policy if exists "Anyone can view active brick owners" on public.brick_owners;
create policy "Anyone can view active brick owners"
  on public.brick_owners for select
  using (is_active);

drop policy if exists "Owners can view their own profile" on public.brick_owners;
create policy "Owners can view their own profile"
  on public.brick_owners for select to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists "Anyone can view active brick listings" on public.brick_listings;
create policy "Anyone can view active brick listings"
  on public.brick_listings for select
  using (is_active);

drop policy if exists "Owners can view their own brick listings" on public.brick_listings;
create policy "Owners can view their own brick listings"
  on public.brick_listings for select to authenticated
  using (public.is_brick_owner(owner_id));

drop policy if exists "Owners can create their own brick listings" on public.brick_listings;
create policy "Owners can create their own brick listings"
  on public.brick_listings for insert to authenticated
  with check (public.is_brick_owner(owner_id));

drop policy if exists "Owners can update their own brick listings" on public.brick_listings;
create policy "Owners can update their own brick listings"
  on public.brick_listings for update to authenticated
  using (public.is_brick_owner(owner_id))
  with check (public.is_brick_owner(owner_id));

drop policy if exists "Owners can view orders for their bricks" on public.brick_orders;
create policy "Owners can view orders for their bricks"
  on public.brick_orders for select to authenticated
  using (public.is_brick_owner(owner_id));

drop policy if exists "Customers can view their own brick orders" on public.brick_orders;
create policy "Customers can view their own brick orders"
  on public.brick_orders for select to authenticated
  using (customer_id = (select auth.uid()));

revoke select on public.brick_owners from anon, authenticated;
grant select (id, display_name_en, display_name_te, location)
  on public.brick_owners to anon, authenticated;
grant select on public.brick_listings to anon, authenticated;
revoke select on public.brick_orders from authenticated;
grant select (
  id, customer_id, customer_name, customer_phone, customer_email, listing_id,
  owner_id, quantity, unit_price, total_amount, status, invoice_number,
  delivery_note, expires_at, paid_at, created_at, updated_at
) on public.brick_orders to authenticated;
grant insert, update on public.brick_listings to authenticated;
grant usage, select on sequence public.brick_invoice_number_seq to service_role;
grant all on public.brick_owners, public.brick_listings, public.brick_orders to service_role;

create or replace function public.get_my_brick_owner()
returns table (id text)
language sql
stable
security definer
set search_path = ''
as $$
  select owner.id
  from public.brick_owners as owner
  where owner.auth_user_id = (select auth.uid())
    and owner.is_active;
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
    where status = 'payment_pending' and expires_at <= now()
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

create or replace function public.reserve_brick_order(
  p_customer_id uuid,
  p_listing_id uuid,
  p_quantity integer,
  p_delivery_note text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text
)
returns table (
  order_id uuid,
  owner_id text,
  listing_name text,
  unit_price numeric,
  total_amount numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_listing public.brick_listings%rowtype;
  reserved_order_id uuid;
begin
  perform public.release_expired_brick_orders();

  if p_quantity < 100 or p_quantity > 1000000 then
    raise exception 'Enter a quantity between 100 and 1,000,000 bricks.';
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

  update public.brick_listings
  set available_stock = available_stock - p_quantity,
      updated_at = now()
  where id = selected_listing.id;

  insert into public.brick_orders (
    customer_id, customer_name, customer_phone, customer_email, listing_id, owner_id,
    quantity, unit_price, total_amount, delivery_note
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
    selected_listing.price_per_brick * p_quantity,
    left(coalesce(p_delivery_note, ''), 1000)
  )
  returning id into reserved_order_id;

  return query
  select reserved_order_id,
         selected_listing.owner_id,
         selected_listing.name,
         selected_listing.price_per_brick,
         selected_listing.price_per_brick * p_quantity;
end;
$$;

create or replace function public.release_brick_order(
  p_order_id uuid,
  p_customer_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending_order public.brick_orders%rowtype;
begin
  select * into pending_order
  from public.brick_orders
  where id = p_order_id
    and customer_id = p_customer_id
    and status = 'payment_pending'
  for update;

  if not found then
    return;
  end if;

  update public.brick_listings
  set available_stock = available_stock + pending_order.quantity,
      updated_at = now()
  where id = pending_order.listing_id;

  update public.brick_orders
  set status = 'payment_failed', updated_at = now()
  where id = pending_order.id;
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
      paid_at = now(),
      updated_at = now()
  where id = selected_order.id;

  return query select next_invoice, selected_order.total_amount;
end;
$$;

create or replace function public.begin_brick_refund(
  p_order_id uuid,
  p_razorpay_payment_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.brick_orders%rowtype;
begin
  select * into selected_order
  from public.brick_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if selected_order.status in ('refund_pending', 'refunded') then
    return false;
  end if;

  if selected_order.status <> 'payment_failed' then
    raise exception 'This order is not eligible for a refund.';
  end if;

  update public.brick_orders
  set status = 'refund_pending',
      razorpay_payment_id = p_razorpay_payment_id,
      updated_at = now()
  where id = p_order_id;

  return true;
end;
$$;

create or replace function public.finish_brick_refund(
  p_order_id uuid,
  p_razorpay_payment_id text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.brick_orders
  set status = 'refunded', updated_at = now()
  where id = p_order_id
    and status = 'refund_pending'
    and razorpay_payment_id = p_razorpay_payment_id;
$$;

create or replace function public.update_brick_order_status(
  p_order_id uuid,
  p_next_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_owner text;
  current_status text;
begin
  select owner_id, status into order_owner, current_status
  from public.brick_orders
  where id = p_order_id
  for update;

  if not found or not exists (
    select 1 from public.brick_owners
    where id = order_owner and auth_user_id = (select auth.uid())
  ) then
    raise exception 'You are not allowed to update this order.';
  end if;

  if not (
    (current_status = 'paid' and p_next_status = 'loading')
    or (current_status = 'loading' and p_next_status = 'dispatched')
    or (current_status = 'dispatched' and p_next_status = 'delivered')
  ) then
    raise exception 'This order status change is not allowed.';
  end if;

  update public.brick_orders
  set status = p_next_status, updated_at = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.release_expired_brick_orders() from public, anon, authenticated;
revoke all on function public.is_brick_owner(text) from public, anon;
revoke all on function public.reserve_brick_order(uuid, uuid, integer, text, text, text, text) from public, anon, authenticated;
revoke all on function public.release_brick_order(uuid, uuid) from public, anon, authenticated;
revoke all on function public.confirm_brick_payment(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.begin_brick_refund(uuid, text) from public, anon, authenticated;
revoke all on function public.finish_brick_refund(uuid, text) from public, anon, authenticated;
revoke all on function public.update_brick_order_status(uuid, text) from public, anon;
revoke all on function public.get_my_brick_owner() from public, anon;
grant execute on function public.get_my_brick_owner() to authenticated;
grant execute on function public.release_expired_brick_orders() to service_role;
grant execute on function public.reserve_brick_order(uuid, uuid, integer, text, text, text, text) to service_role;
grant execute on function public.release_brick_order(uuid, uuid) to service_role;
grant execute on function public.confirm_brick_payment(uuid, uuid, text, text) to service_role;
grant execute on function public.begin_brick_refund(uuid, text) to service_role;
grant execute on function public.finish_brick_refund(uuid, text) to service_role;
grant execute on function public.update_brick_order_status(uuid, text) to authenticated;
grant execute on function public.is_brick_owner(text) to authenticated;
