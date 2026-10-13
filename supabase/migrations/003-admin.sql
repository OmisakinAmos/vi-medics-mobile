-- Admin area: who is an admin, and what admins are allowed to do. Safe to re-run.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Admins live in their own table (NOT on profiles) because customers can edit their own profile row.
-- RLS is enabled with no policies on `admins`, so the browser can never read or change it.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- anon needs execute too: the products policy calls is_admin() for logged-out shoppers (it simply returns false for them).
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Products: admins can see every product (including hidden ones) and add, edit or archive them.
drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

-- Customers, orders and order items: admins can read everything.
drop policy if exists "Admins read profiles" on public.profiles;
create policy "Admins read profiles"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "Admins read orders" on public.orders;
create policy "Admins read orders"
  on public.orders for select
  using (public.is_admin());

drop policy if exists "Admins update orders" on public.orders;
create policy "Admins update orders"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins read order items" on public.order_items;
create policy "Admins read order items"
  on public.order_items for select
  using (public.is_admin());

-- Product photos: admins can upload to the public `product-images` bucket.
drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins update product images" on storage.objects;
create policy "Admins update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- Make the store owner an admin. The account must already exist (sign up on the site first).
insert into public.admins (user_id)
select id from auth.users where lower(email) = 'olutimilehinamos@gmail.com'
on conflict do nothing;

-- Check: this should return one row. If it returns nothing, sign up on the site with that email and run this file again.
select u.email, a.user_id from public.admins a join auth.users u on u.id = a.user_id;
