-- 008: accounting and expenses.
-- Safe to re-run. Run in Supabase -> SQL Editor AFTER 007.
--
-- Product cost prices live in an ADMIN-ONLY table, not on the public products table,
-- so visitors and customers can never see what an item costs you.

-- ------------------------------------------------------------- product costs
create table if not exists public.product_costs (
  product_id  text primary key references public.products (id) on delete cascade,
  cost_price  numeric(12,2) not null default 0 check (cost_price >= 0 and cost_price <= 1000000000),
  updated_at  timestamptz not null default now()
);
alter table public.product_costs enable row level security;
drop policy if exists "Admins manage product costs" on public.product_costs;
create policy "Admins manage product costs" on public.product_costs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on table public.product_costs from anon, authenticated;
grant select, insert, update, delete on public.product_costs to authenticated;

-- Cost of each sold item at the time of sale (written by place_order).
create table if not exists public.order_item_costs (
  order_item_id  uuid primary key references public.order_items (id) on delete cascade,
  unit_cost      numeric(12,2) not null check (unit_cost >= 0)
);
alter table public.order_item_costs enable row level security;
drop policy if exists "Admins read order item costs" on public.order_item_costs;
create policy "Admins read order item costs" on public.order_item_costs for select to authenticated
  using (public.is_admin());
revoke all on table public.order_item_costs from anon, authenticated;
grant select on public.order_item_costs to authenticated;

-- ------------------------------------------------------------------ expenses
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  spent_on     date not null default current_date,
  category     text not null check (category in ('stock', 'marketing', 'other')),
  description  text not null check (char_length(description) between 2 and 200),
  vendor       text check (vendor is null or char_length(vendor) <= 100),
  amount       numeric(14,2) not null check (amount > 0 and amount <= 10000000000),
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists expenses_spent_on_idx on public.expenses (spent_on desc);
alter table public.expenses enable row level security;
drop policy if exists "Admins manage expenses" on public.expenses;
create policy "Admins manage expenses" on public.expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on table public.expenses from anon, authenticated;
grant select, insert, update, delete on public.expenses to authenticated;

-- Every change to the books goes into the audit trail.
create or replace function public.expenses_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('expense.added', 'expense', new.id::text,
      format('Added %s expense: %s (NGN %s)', new.category, new.description, new.amount),
      jsonb_build_object('amount', new.amount, 'category', new.category, 'vendor', new.vendor, 'spent_on', new.spent_on));
  elsif tg_op = 'UPDATE' then
    perform public.write_audit('expense.updated', 'expense', new.id::text,
      format('Edited expense: %s (NGN %s)', new.description, new.amount),
      jsonb_build_object('from', to_jsonb(old), 'to', to_jsonb(new)));
  else
    perform public.write_audit('expense.deleted', 'expense', old.id::text,
      format('Deleted %s expense: %s (NGN %s)', old.category, old.description, old.amount),
      to_jsonb(old));
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists expenses_audit on public.expenses;
create trigger expenses_audit after insert or update or delete on public.expenses
  for each row execute function public.expenses_audit();

create or replace function public.product_costs_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'UPDATE' and new.cost_price = old.cost_price then return new; end if;
  perform public.write_audit('product.cost_changed', 'product', new.product_id,
    format('Cost price of %s set to NGN %s', new.product_id, new.cost_price),
    jsonb_build_object('from', case when tg_op = 'UPDATE' then old.cost_price end, 'to', new.cost_price));
  return new;
end;
$$;
drop trigger if exists product_costs_audit on public.product_costs;
create trigger product_costs_audit after insert or update on public.product_costs
  for each row execute function public.product_costs_audit();

-- ------------------------------------------- place_order: also remember cost
create or replace function public.place_order(p_items jsonb, p_customer jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_order_id  uuid;
  v_number    bigint;
  v_subtotal  numeric := 0;
  v_delivery  numeric := 0;      -- delivery is arranged outside the application
  v_item      record;
  v_product   public.products%rowtype;
  v_name      text := btrim(coalesce(p_customer->>'name', ''));
  v_email     text := lower(btrim(coalesce(p_customer->>'email', '')));
  v_phone     text := btrim(coalesce(p_customer->>'phone', ''));
  v_address   text := btrim(coalesce(p_customer->>'address', ''));
  v_city      text := btrim(coalesce(p_customer->>'city', ''));
  v_state     text := btrim(coalesce(p_customer->>'state', ''));
  v_open      integer;
  v_item_id   uuid;
  v_cost      numeric;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'Too many items in one order'; end if;
  if jsonb_typeof(p_customer) <> 'object' then raise exception 'Customer details are required'; end if;

  if length(v_name) < 2 or length(v_name) > 100 then raise exception 'Please enter a valid name'; end if;
  if v_email !~ '^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$' or length(v_email) > 254 then raise exception 'Please enter a valid email address'; end if;
  if v_phone !~ '^[0-9+()\-\s]{7,20}$' then raise exception 'Please enter a valid phone number'; end if;
  if length(v_address) < 5 or length(v_address) > 300 then raise exception 'Please enter a valid delivery address'; end if;
  if length(v_city) < 2 or length(v_city) > 100 or length(v_state) < 2 or length(v_state) > 100 then
    raise exception 'Please enter a valid city and state';
  end if;

  -- Free up stock held by stale unpaid orders, then cap how many unpaid orders one customer can hold.
  perform public.expire_unpaid_orders();
  select count(*) into v_open from public.orders
  where user_id = v_user and status = 'pending' and payment_status = 'awaiting';
  if v_open >= 3 then
    raise exception 'You have 3 unpaid orders. Please pay for or cancel one in My Orders first.';
  end if;

  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;

  insert into public.orders (user_id, delivery_fee, customer_name, customer_email, customer_phone, address, city, state, country)
  values (v_user, v_delivery, v_name, v_email, v_phone, v_address, v_city, v_state, 'Nigeria')
  returning id, order_number into v_order_id, v_number;

  -- Duplicate product lines are merged; quantity per product is capped.
  for v_item in
    select e->>'product_id' as product_id, sum((e->>'quantity')::bigint) as quantity
    from jsonb_array_elements(p_items) as e
    group by e->>'product_id'
    order by e->>'product_id'
  loop
    if v_item.quantity is null or v_item.quantity < 1 or v_item.quantity > 100 then
      raise exception 'Invalid quantity for %', left(coalesce(v_item.product_id, '?'), 40);
    end if;

    select * into v_product from public.products
    where id = v_item.product_id and status = 'active' for update;
    if not found then raise exception 'Product % is not available', left(coalesce(v_item.product_id, '?'), 40); end if;
    if v_product.stock_quantity < v_item.quantity then
      raise exception 'Insufficient stock for % (only % left)', v_product.name, v_product.stock_quantity;
    end if;

    update public.products set stock_quantity = stock_quantity - v_item.quantity::int where id = v_product.id;
    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_item.quantity::int)
    returning id into v_item_id;

    -- Remember what this item cost us at the time of sale (admin-only table), so profit stays accurate if costs change later.
    select cost_price into v_cost from public.product_costs where product_id = v_product.id;
    if coalesce(v_cost, 0) > 0 then
      insert into public.order_item_costs (order_item_id, unit_cost) values (v_item_id, v_cost);
    end if;
    v_subtotal := v_subtotal + v_product.price * v_item.quantity;
  end loop;

  update public.orders set subtotal = v_subtotal, total = v_subtotal + v_delivery where id = v_order_id;

  perform public.write_audit('order.placed', 'order', v_order_id::text,
    format('Order VM-%s placed (NGN %s, awaiting bank transfer)', v_number, v_subtotal + v_delivery),
    jsonb_build_object('order_number', 'VM-' || v_number, 'subtotal', v_subtotal, 'delivery_fee', v_delivery,
      'total', v_subtotal + v_delivery, 'customer', v_name, 'customer_email', v_email));
  return v_order_id;
end;
$$;
revoke all on function public.place_order(jsonb, jsonb) from public, anon;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;
