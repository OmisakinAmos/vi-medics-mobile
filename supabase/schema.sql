-- Vi-Medics database schema (Phase 2)
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Then run supabase/seed.sql to load the starter catalogue.

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  created_at  timestamptz not null default now()
);

-- Create a profile automatically whenever a user signs up (e.g. via Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- products
create table if not exists public.products (
  id                 text primary key,               -- e.g. 'vm-001'
  name               text not null,
  category           text not null check (category in ('Monitoring','Diagnostic','Mobility','Respiratory','General')),
  description        text not null,
  short_description  text,
  price              numeric(12,2) not null check (price >= 0),
  stock_quantity     integer not null default 0 check (stock_quantity >= 0),
  image_url          text,
  visual             text not null default 'bp',     -- key of the CSS placeholder illustration
  brand              text not null,
  model              text not null,
  specifications     jsonb not null default '{}'::jsonb,
  warranty           text not null,
  status             text not null default 'active' check (status in ('active','draft','archived')),
  created_at         timestamptz not null default now()
);

-- ------------------------------------------------------------------ orders
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     bigint generated always as identity (start with 10001) unique,
  user_id          uuid not null references public.profiles (id) on delete restrict,
  status           text not null default 'confirmed' check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  subtotal         numeric(12,2) not null default 0,
  delivery_fee     numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  customer_name    text not null,
  customer_email   text not null,
  customer_phone   text not null,
  address          text not null,
  city             text not null,
  state            text not null,
  country          text not null default 'Nigeria',
  created_at       timestamptz not null default now()
);
create index if not exists orders_user_id_idx on public.orders (user_id, created_at desc);

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    text not null references public.products (id) on delete restrict,
  product_name  text not null,                       -- snapshot at purchase time
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  quantity      integer not null check (quantity > 0)
);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- ------------------------------------------------- Row Level Security (RLS)
alter table public.profiles    enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Products: anyone can read active products. No client-side writes.
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
  on public.products for select
  using (status = 'active');

-- Profiles: users can read and update only their own profile.
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Orders: users can read only their own orders. Inserts happen only through place_order().
drop policy if exists "Users read own orders" on public.orders;
create policy "Users read own orders"
  on public.orders for select
  using (auth.uid() = user_id);

drop policy if exists "Users read own order items" on public.order_items;
create policy "Users read own order items"
  on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- ------------------------------------------------------------ place_order()
-- Atomically validates stock, decrements it, and creates the order + items.
-- Prices come from the products table, never from the client.
-- p_items:    [{"product_id":"vm-001","quantity":2}, ...]
-- p_customer: {"name","email","phone","address","city","state","country"}
create or replace function public.place_order(p_items jsonb, p_customer jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_order_id  uuid;
  v_subtotal  numeric := 0;
  v_delivery  numeric := 5000;   -- keep in sync with DELIVERY_FEE in src/lib/format.ts
  v_item      record;
  v_product   public.products%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;

  insert into public.orders (user_id, delivery_fee, customer_name, customer_email, customer_phone, address, city, state, country)
  values (
    v_user, v_delivery,
    p_customer->>'name', p_customer->>'email', p_customer->>'phone',
    p_customer->>'address', p_customer->>'city', p_customer->>'state',
    coalesce(p_customer->>'country', 'Nigeria')
  )
  returning id into v_order_id;

  for v_item in
    select e->>'product_id' as product_id, (e->>'quantity')::int as quantity
    from jsonb_array_elements(p_items) as e
  loop
    if v_item.quantity is null or v_item.quantity < 1 then
      raise exception 'Invalid quantity for %', v_item.product_id;
    end if;

    select * into v_product
    from public.products
    where id = v_item.product_id and status = 'active'
    for update;

    if not found then
      raise exception 'Product % is not available', v_item.product_id;
    end if;
    if v_product.stock_quantity < v_item.quantity then
      raise exception 'Insufficient stock for % (only % left)', v_product.name, v_product.stock_quantity;
    end if;

    update public.products set stock_quantity = stock_quantity - v_item.quantity where id = v_product.id;

    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_item.quantity);

    v_subtotal := v_subtotal + v_product.price * v_item.quantity;
  end loop;

  update public.orders set subtotal = v_subtotal, total = v_subtotal + v_delivery where id = v_order_id;
  return v_order_id;
end;
$$;

revoke all on function public.place_order(jsonb, jsonb) from public, anon;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;
