-- Bank-transfer payments, delivery tracking, payment settings and the audit trail. Safe to re-run.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. (Requires 003-admin.sql to have been run.)

-- ------------------------------------------------------------------ orders
alter table public.orders add column if not exists payment_status text not null default 'awaiting'
  check (payment_status in ('awaiting', 'reported', 'confirmed'));
alter table public.orders add column if not exists payment_method text not null default 'bank_transfer';
alter table public.orders add column if not exists paid_reported_at timestamptz;
alter table public.orders add column if not exists payment_confirmed_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;

-- New orders now start as "pending" (awaiting payment). The admin confirms payment, then ships and delivers.
alter table public.orders alter column status set default 'pending';

-- ---------------------------------------------------------- store settings
-- Bank details shown at payment. Anyone may read them (customers need them); only admins may change them.
create table if not exists public.store_settings (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz not null default now()
);
alter table public.store_settings enable row level security;

drop policy if exists "Public read store settings" on public.store_settings;
create policy "Public read store settings" on public.store_settings for select using (true);

drop policy if exists "Admins manage store settings" on public.store_settings;
create policy "Admins manage store settings" on public.store_settings for all
  using (public.is_admin()) with check (public.is_admin());

grant select on public.store_settings to anon, authenticated;

insert into public.store_settings (key, value) values ('bank_name', ''), ('account_name', ''), ('account_number', '')
on conflict (key) do nothing;

-- --------------------------------------------------------------- audit log
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  actor_id     uuid,
  actor_email  text,
  actor_name   text,
  actor_role   text not null default 'customer',   -- admin | customer | system
  action       text not null,                      -- e.g. order.status_changed
  entity       text,                               -- order | product | user | settings
  entity_id    text,
  summary      text not null,
  details      jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id);

alter table public.audit_log enable row level security;
drop policy if exists "Admins read audit log" on public.audit_log;
create policy "Admins read audit log" on public.audit_log for select using (public.is_admin());

-- Nobody can edit or delete the trail from the app: only SELECT is granted, and only admins pass RLS.
revoke all on table public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

-- Internal writer. Not callable from the browser; triggers and security-definer functions use it.
create or replace function public.write_audit(p_action text, p_entity text, p_entity_id text, p_summary text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_name  text;
  v_role  text := 'system';
begin
  if v_uid is not null then
    select coalesce(p.email, u.email), p.full_name into v_email, v_name
    from auth.users u left join public.profiles p on p.id = u.id
    where u.id = v_uid;
    v_role := case when public.is_admin() then 'admin' else 'customer' end;
  end if;
  insert into public.audit_log (actor_id, actor_email, actor_name, actor_role, action, entity, entity_id, summary, details)
  values (v_uid, v_email, v_name, v_role, p_action, p_entity, p_entity_id, p_summary, coalesce(p_details, '{}'::jsonb));
end;
$$;
revoke all on function public.write_audit(text, text, text, text, jsonb) from public, anon, authenticated;

-- Sign-in / sign-out events reported by the app.
create or replace function public.log_event(p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if p_action not in ('auth.sign_in', 'auth.sign_out') then raise exception 'Unknown event'; end if;
  perform public.write_audit(p_action, 'user', auth.uid()::text,
    case p_action when 'auth.sign_in' then 'Signed in' else 'Signed out' end);
end;
$$;
revoke all on function public.log_event(text) from public, anon;
grant execute on function public.log_event(text) to authenticated;

-- ----------------------------------------------------------- order triggers
create or replace function public.orders_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'A cancelled order cannot be reopened';
  end if;

  if new.status = 'delivered' and old.status <> 'delivered' then
    new.delivered_at := now();
  elsif new.status <> 'delivered' then
    new.delivered_at := null;
  end if;

  if new.payment_status = 'confirmed' and old.payment_status <> 'confirmed' then
    new.payment_confirmed_at := now();
  end if;

  -- Cancelling returns the reserved stock to the shelf.
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.products p set stock_quantity = p.stock_quantity + oi.quantity
    from public.order_items oi
    where oi.order_id = new.id and p.id = oi.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_before_update on public.orders;
create trigger orders_before_update before update on public.orders
  for each row execute function public.orders_before_update();

create or replace function public.orders_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.write_audit('order.status_changed', 'order', new.id::text,
      format('Order VM-%s: status %s -> %s', new.order_number, old.status, new.status),
      jsonb_build_object('order_number', 'VM-' || new.order_number, 'from', old.status, 'to', new.status,
        'customer', new.customer_name, 'customer_email', new.customer_email, 'total', new.total,
        'stock_returned', new.status = 'cancelled'));
  end if;
  if new.payment_status is distinct from old.payment_status then
    perform public.write_audit(
      case new.payment_status when 'reported' then 'order.payment_reported' when 'confirmed' then 'order.payment_confirmed' else 'order.payment_changed' end,
      'order', new.id::text,
      case new.payment_status
        when 'reported' then format('Customer reported payment for order VM-%s', new.order_number)
        when 'confirmed' then format('Payment confirmed for order VM-%s', new.order_number)
        else format('Order VM-%s payment status: %s -> %s', new.order_number, old.payment_status, new.payment_status) end,
      jsonb_build_object('order_number', 'VM-' || new.order_number, 'from', old.payment_status, 'to', new.payment_status,
        'customer', new.customer_name, 'customer_email', new.customer_email, 'total', new.total));
  end if;
  return new;
end;
$$;

drop trigger if exists orders_audit on public.orders;
create trigger orders_audit after update on public.orders
  for each row execute function public.orders_audit();

-- ---------------------------------------------------------- product triggers
-- Only admin edits are logged (customer purchases already appear as orders).
create or replace function public.products_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed jsonb;
begin
  if not public.is_admin() then return coalesce(new, old); end if;

  if tg_op = 'INSERT' then
    perform public.write_audit('product.created', 'product', new.id,
      format('Added product %s (%s)', new.name, new.id),
      jsonb_build_object('price', new.price, 'stock', new.stock_quantity, 'category', new.category, 'status', new.status));
  elsif tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value)), '{}'::jsonb)
      into v_changed
    from jsonb_each(to_jsonb(new)) as n(key, value)
    join jsonb_each(to_jsonb(old)) as o(key, value) on o.key = n.key
    where n.value is distinct from o.value;
    if v_changed <> '{}'::jsonb then
      perform public.write_audit('product.updated', 'product', new.id,
        format('Edited product %s: %s', new.name, (select string_agg(k, ', ') from jsonb_object_keys(v_changed) as k)),
        v_changed);
    end if;
  else
    perform public.write_audit('product.deleted', 'product', old.id, format('Deleted product %s (%s)', old.name, old.id));
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists products_audit on public.products;
create trigger products_audit after insert or update or delete on public.products
  for each row execute function public.products_audit();

-- ----------------------------------------------------- settings + profiles
create or replace function public.settings_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.value is distinct from old.value then
    perform public.write_audit('settings.updated', 'settings', new.key,
      format('Payment setting "%s" changed', new.key), jsonb_build_object('from', old.value, 'to', new.value));
  end if;
  return new;
end;
$$;
drop trigger if exists settings_audit on public.store_settings;
create trigger settings_audit after update on public.store_settings
  for each row execute function public.settings_audit();

create or replace function public.profiles_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.write_audit('customer.registered', 'user', new.id::text,
    format('New account: %s', coalesce(new.email, '(no email)')),
    jsonb_build_object('email', new.email, 'name', new.full_name));
  return new;
end;
$$;
drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after insert on public.profiles
  for each row execute function public.profiles_audit();

-- ------------------------------------------------------------ place_order()
-- Same as before (stock check, prices from the DB), plus an audit entry. New orders start as pending / awaiting payment.
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
  returning id, order_number into v_order_id, v_number;

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

  perform public.write_audit('order.placed', 'order', v_order_id::text,
    format('Order VM-%s placed (NGN %s, awaiting bank transfer)', v_number, v_subtotal + v_delivery),
    jsonb_build_object('order_number', 'VM-' || v_number, 'subtotal', v_subtotal, 'delivery_fee', v_delivery,
      'total', v_subtotal + v_delivery, 'customer', p_customer->>'name', 'customer_email', p_customer->>'email',
      'items', p_items));
  return v_order_id;
end;
$$;

revoke all on function public.place_order(jsonb, jsonb) from public, anon;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------- report_payment()
-- "I have paid": the customer tells us the transfer is done. The admin then confirms it against the bank account.
create or replace function public.report_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status = 'cancelled' then raise exception 'This order was cancelled'; end if;
  if v_order.payment_status = 'awaiting' then
    update public.orders set payment_status = 'reported', paid_reported_at = now() where id = v_order.id;
  end if;
end;
$$;
revoke all on function public.report_payment(uuid) from public, anon;
grant execute on function public.report_payment(uuid) to authenticated;
