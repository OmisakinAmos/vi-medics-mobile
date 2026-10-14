-- Fix: logged-out visitors got "permission denied for function is_admin" when loading products,
-- because the products policy calls is_admin() and anon was not allowed to run it. Safe to re-run.
grant execute on function public.is_admin() to anon;
