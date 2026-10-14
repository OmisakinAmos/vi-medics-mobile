-- 007: security hardening + delivery fee handled outside the app.
-- Safe to re-run. Run in Supabase -> SQL Editor.
--
-- Findings fixed (from the pen test of migration 006):
--  F1  One customer could reserve ALL stock with unpaid orders (stock-lock denial of service).
--  F2  place_order accepted junk: invalid emails, 2 MB text, duplicate lines, huge quantities.
--  F3  No way for a customer to cancel their own unpaid order.
--  F4  Sign-in/out logging could be spammed to flood the audit trail.
--  F5  Receipt emails could be triggered repeatedly (email bombing / Mailgun quota).
--  F6  Bank details were readable by logged-out visitors.
--  Delivery fee is no longer added to the total (it is arranged separately).

alter table public.orders add column if not exists receipt_sent_at timestamptz;

-- -------------------------------------------------------- expire stale unpaid orders (F1)
-- Unpaid orders older than 24h are cancelled; the existing trigger puts the stock back.
create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.orders set status = 'cancelled'
  where status = 'pending' and payment_status = 'awaiting' and created_at < now() - interval '24 hours';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.expire_unpaid_orders() from public, anon, authenticated;
-- Optional: if pg_cron is enabled (Database -> Extensions), also run it hourly:
--   select cron.schedule('expire-unpaid-orders', '0 * * * *', 'select public.expire_unpaid_orders()');

-- -------------------------------------------------------- cancel my own unpaid order (F3)
create or replace function public.cancel_my_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status = 'cancelled' then return; end if;
  if v_order.status <> 'pending' or v_order.payment_status <> 'awaiting' then
    raise exception 'This order can no longer be cancelled here. Please contact us.';
  end if;
  update public.orders set status = 'cancelled' where id = v_order.id;
end;
$$;
revoke all on function public.cancel_my_order(uuid) from public, anon;
grant execute on function public.cancel_my_order(uuid) to authenticated;

-- -------------------------------------------------------- place_order: validation + caps + no delivery (F1, F2)
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
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_item.quantity::int);
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

-- -------------------------------------------------------- log_event throttle (F4)
create or replace function public.log_event(p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if p_action not in ('auth.sign_in', 'auth.sign_out') then raise exception 'Unknown event'; end if;
  -- at most one of each event per user per 5 minutes
  if exists (select 1 from public.audit_log
             where actor_id = auth.uid() and action = p_action and created_at > now() - interval '5 minutes') then
    return;
  end if;
  perform public.write_audit(p_action, 'user', auth.uid()::text,
    case p_action when 'auth.sign_in' then 'Signed in' else 'Signed out' end);
end;
$$;
revoke all on function public.log_event(text) from public, anon;
grant execute on function public.log_event(text) to authenticated;

-- -------------------------------------------------------- receipt email rate limit (F5)
-- Returns true if a receipt may be sent now (and records it). One send per order per 2 minutes, only after "I have paid".
create or replace function public.claim_receipt_send(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.orders set receipt_sent_at = now()
  where id = p_order_id and user_id = auth.uid()
    and payment_status <> 'awaiting' and status <> 'cancelled'
    and (receipt_sent_at is null or receipt_sent_at < now() - interval '2 minutes');
  get diagnostics n = row_count;
  return n = 1;
end;
$$;
revoke all on function public.claim_receipt_send(uuid) from public, anon;
grant execute on function public.claim_receipt_send(uuid) to authenticated;

-- -------------------------------------------------------- bank details: signed-in users only, known keys only (F6)
drop policy if exists "Public read store settings" on public.store_settings;
drop policy if exists "Signed-in read store settings" on public.store_settings;
create policy "Signed-in read store settings" on public.store_settings for select to authenticated
  using (key in ('bank_name', 'account_name', 'account_number'));
revoke all on table public.store_settings from anon;
