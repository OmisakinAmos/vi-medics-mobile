import type { Page, Route } from '@playwright/test';
import { mockProducts } from '../../../src/data/products';

/**
 * A stand-in for Supabase, used by the end-to-end tests.
 *
 * The app is built to talk to https://fake.supabase.test. This file answers those requests inside the browser
 * (Playwright route interception), so the tests never touch the real database, never create real accounts or
 * orders, and never need secrets. It copies the rules that matter from the real database:
 *   - customers only see their own orders; only admins see everyone's and the accounting tables
 *   - place_order checks stock, caps unpaid orders at 3, and puts no delivery fee on the total
 *   - bank details are only readable by signed-in users
 * Keep this in step with supabase/migrations when those rules change.
 */

export const FAKE_HOST = 'fake.supabase.test';
export const ANON_KEY = 'test-anon-key';

type Json = Record<string, unknown>;
type User = { id: string; email: string; password: string; full_name: string; admin: boolean };
type OrderItem = { id: string; order_id: string; product_id: string; product_name: string; unit_price: number; quantity: number };
type Order = Json & { id: string; user_id: string; order_number: number; status: string; payment_status: string; total: number; order_items: OrderItem[] };

export type FakeOptions = {
  /** Stock override by product id, e.g. { 'vm-003': 3 }. */
  stock?: Record<string, number>;
  /** Make /api/send-receipt fail (to test the "could not email" message). */
  emailFails?: boolean;
  /** Accounts that exist before the test starts. */
  users?: { email: string; password: string; fullName: string; admin?: boolean }[];
  /** Orders that exist before the test starts (used for the accounting tests). */
  seedOrders?: { userEmail: string; items: { productId: string; quantity: number }[]; status?: string; paymentStatus?: string; city?: string; state?: string; daysAgo?: number }[];
};

export type FakeBackend = {
  orders: Order[];
  expenses: Json[];
  receiptRequests: { orderId: string; hasToken: boolean }[];
  products: Json[];
  userByEmail: (email: string) => User | undefined;
};

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'access-control-expose-headers': '*',
};

const uuid = () => crypto.randomUUID();

export async function installFakeBackend(page: Page, options: FakeOptions = {}): Promise<FakeBackend> {
  const now = Date.now();
  const products: Json[] = mockProducts.map((p, i) => ({
    id: p.id, name: p.name, category: p.category, description: p.description, short_description: p.shortDescription ?? null,
    price: p.price, stock_quantity: options.stock?.[p.id] ?? p.stockQuantity, brand: p.brand, model: p.model, warranty: p.warranty,
    visual: p.visual, image_url: null, specifications: p.specifications ?? null, status: 'active',
    created_at: new Date(now - (100 - i) * 86400000).toISOString(),
  }));

  const users: User[] = (options.users ?? []).map((u) => ({ id: uuid(), email: u.email, password: u.password, full_name: u.fullName, admin: Boolean(u.admin) }));
  const tokens = new Map<string, string>(); // access token -> user id
  const orders: Order[] = [];
  const expenses: Json[] = [];
  const productCosts: Record<string, number> = { 'vm-001': 30000, 'vm-002': 11000 };
  const settings: Record<string, string> = { bank_name: 'Test Bank', account_name: 'Vi-Medics Test Account', account_number: '0123456789' };
  const receiptRequests: FakeBackend['receiptRequests'] = [];
  let nextOrderNumber = 10001;

  const backend: FakeBackend = { orders, expenses, receiptRequests, products, userByEmail: (e) => users.find((u) => u.email === e) };

  // ---------------------------------------------------------------- helpers
  const userFor = (route: Route): User | undefined => {
    const auth = route.request().headers()['authorization'] ?? '';
    const token = auth.replace(/^Bearer\s+/i, '');
    const id = tokens.get(token);
    return users.find((u) => u.id === id);
  };

  const reply = (route: Route, status: number, body?: unknown, extra: Record<string, string> = {}) =>
    route.fulfill({
      status,
      headers: { ...cors, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const dbError = (route: Route, status: number, message: string, code = 'P0001') => reply(route, status, { code, message, details: null, hint: null });

  const sessionFor = (u: User) => {
    const token = `tok_${uuid()}`;
    tokens.set(token, u.id);
    return {
      access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: `ref_${uuid()}`,
      user: { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: { full_name: u.full_name }, created_at: new Date().toISOString() },
    };
  };

  const makeOrder = (u: User, items: { product_id: string; quantity: number }[], customer: Json, extra: Json = {}): Order => {
    const id = uuid();
    const orderItems: OrderItem[] = [];
    let subtotal = 0;
    for (const it of items) {
      const p = products.find((x) => x.id === it.product_id) as Json;
      p.stock_quantity = (p.stock_quantity as number) - it.quantity;
      orderItems.push({ id: uuid(), order_id: id, product_id: it.product_id, product_name: p.name as string, unit_price: p.price as number, quantity: it.quantity });
      subtotal += (p.price as number) * it.quantity;
    }
    const order: Order = {
      id, user_id: u.id, order_number: nextOrderNumber++, status: 'pending', payment_status: 'awaiting',
      subtotal, delivery_fee: 0, total: subtotal, created_at: new Date().toISOString(),
      paid_reported_at: null, payment_confirmed_at: null, delivered_at: null,
      customer_name: customer.name, customer_email: customer.email, customer_phone: customer.phone,
      address: customer.address, city: customer.city, state: customer.state, country: customer.country ?? 'Nigeria',
      order_items: orderItems, ...extra,
    };
    orders.unshift(order);
    return order;
  };

  const restock = (o: Order) => {
    for (const it of o.order_items) {
      const p = products.find((x) => x.id === it.product_id) as Json | undefined;
      if (p) p.stock_quantity = (p.stock_quantity as number) + it.quantity;
    }
  };

  // Seed data for accounting tests.
  for (const s of options.seedOrders ?? []) {
    const u = users.find((x) => x.email === s.userEmail);
    if (!u) throw new Error(`seed order: unknown user ${s.userEmail}`);
    const o = makeOrder(u, s.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
      { name: u.full_name, email: u.email, phone: '08000000000', address: '1 Seed Street', city: s.city ?? 'Ikeja', state: s.state ?? 'Lagos' },
      { status: s.status ?? 'confirmed', payment_status: s.paymentStatus ?? 'confirmed' });
    const at = new Date(Date.now() - (s.daysAgo ?? 1) * 86400000).toISOString();
    o.created_at = at;
    if (o.payment_status === 'confirmed') o.payment_confirmed_at = at;
    if (o.status === 'cancelled') restock(o);
  }

  // --------------------------------------------------------- query helpers
  const matches = (row: Json, url: URL): boolean => {
    for (const [key, raw] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
      const [op, ...rest] = raw.split('.');
      const val = rest.join('.');
      const cell = row[key];
      if (op === 'eq' && String(cell) !== val) return false;
      if (op === 'neq' && String(cell) === val) return false;
      if (op === 'in') {
        const list = val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''));
        if (!list.includes(String(cell))) return false;
      }
    }
    return true;
  };

  const sortRows = <T extends Json>(rows: T[], url: URL): T[] => {
    const order = url.searchParams.get('order');
    if (!order) return rows;
    const keys = order.split(',').map((o) => { const [col, dir] = o.split('.'); return { col, asc: dir !== 'desc' }; });
    return [...rows].sort((a, b) => {
      for (const k of keys) {
        const av = a[k.col] as string | number; const bv = b[k.col] as string | number;
        if (av === bv) continue;
        return (av > bv ? 1 : -1) * (k.asc ? 1 : -1);
      }
      return 0;
    });
  };

  const page_ = <T,>(rows: T[], url: URL): T[] => {
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = url.searchParams.get('limit');
    return rows.slice(offset, limit ? offset + Number(limit) : undefined);
  };

  const respondRows = (route: Route, rows: Json[], url: URL) => {
    const out = page_(sortRows(rows, url), url);
    if ((route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')) {
      if (out.length !== 1) return reply(route, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${out.length} rows`, hint: null });
      return reply(route, 200, out[0]);
    }
    return reply(route, 200, out);
  };

  const body = (route: Route): Json => { try { return (route.request().postDataJSON() ?? {}) as Json; } catch { return {}; } };

  // ------------------------------------------------------------------ auth
  await page.route(`https://${FAKE_HOST}/auth/v1/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return reply(route, 204);
    const url = new URL(req.url());
    const path = url.pathname.replace('/auth/v1', '');

    if (path === '/token' && url.searchParams.get('grant_type') === 'password') {
      const { email, password } = body(route) as { email: string; password: string };
      const u = users.find((x) => x.email === email?.toLowerCase());
      if (!u || u.password !== password) return reply(route, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return reply(route, 200, sessionFor(u));
    }
    if (path === '/token') return reply(route, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
    if (path === '/signup') {
      const b = body(route) as { email: string; password: string; data?: { full_name?: string } };
      if (users.some((x) => x.email === b.email.toLowerCase())) return reply(route, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      const u: User = { id: uuid(), email: b.email.toLowerCase(), password: b.password, full_name: b.data?.full_name ?? '', admin: false };
      users.push(u);
      return reply(route, 200, sessionFor(u));
    }
    if (path === '/logout') return reply(route, 204);
    if (path === '/user') {
      const u = userFor(route);
      if (!u) return reply(route, 401, { code: 401, msg: 'invalid JWT' });
      return reply(route, 200, sessionFor(u).user);
    }
    return reply(route, 404, { msg: `fake auth: ${path} not implemented` });
  });

  // ------------------------------------------------------------------ REST
  await page.route(`https://${FAKE_HOST}/rest/v1/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return reply(route, 204);
    const url = new URL(req.url());
    const path = url.pathname.replace('/rest/v1/', '');
    const user = userFor(route);
    const isAdmin = Boolean(user?.admin);
    const method = req.method();

    // ---- RPC functions
    if (path.startsWith('rpc/')) {
      const fn = path.slice(4);
      const args = body(route);
      if (fn === 'is_admin') return reply(route, 200, isAdmin);
      if (fn === 'log_event') return reply(route, 204);
      if (!user) return dbError(route, 401, `permission denied for function ${fn}`, '42501');

      if (fn === 'place_order') {
        const items = args.p_items as { product_id: string; quantity: number }[];
        const c = args.p_customer as Json;
        if (!Array.isArray(items) || items.length === 0) return dbError(route, 400, 'Cart is empty');
        if (String(c.name ?? '').trim().length < 2) return dbError(route, 400, 'Please enter a valid name');
        if (!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(String(c.email ?? ''))) return dbError(route, 400, 'Please enter a valid email address');
        if (!/^[0-9+()\-\s]{7,20}$/.test(String(c.phone ?? ''))) return dbError(route, 400, 'Please enter a valid phone number');
        if (String(c.address ?? '').trim().length < 5) return dbError(route, 400, 'Please enter a valid delivery address');
        const open = orders.filter((o) => o.user_id === user.id && o.status === 'pending' && o.payment_status === 'awaiting').length;
        if (open >= 3) return dbError(route, 400, 'You have 3 unpaid orders. Please pay for or cancel one in My Orders first.');
        const merged = new Map<string, number>();
        for (const it of items) merged.set(it.product_id, (merged.get(it.product_id) ?? 0) + it.quantity);
        for (const [pid, qty] of merged) {
          const p = products.find((x) => x.id === pid && x.status === 'active') as Json | undefined;
          if (!p) return dbError(route, 400, `Product ${pid} is not available`);
          if (qty < 1 || qty > 100) return dbError(route, 400, `Invalid quantity for ${pid}`);
          if ((p.stock_quantity as number) < qty) return dbError(route, 400, `Insufficient stock for ${p.name} (only ${p.stock_quantity} left)`);
        }
        const order = makeOrder(user, [...merged].map(([product_id, quantity]) => ({ product_id, quantity })), c);
        return reply(route, 200, order.id);
      }
      if (fn === 'report_payment') {
        const o = orders.find((x) => x.id === args.p_order_id && x.user_id === user.id);
        if (!o) return dbError(route, 400, 'Order not found');
        if (o.status === 'cancelled') return dbError(route, 400, 'This order was cancelled');
        if (o.payment_status === 'awaiting') { o.payment_status = 'reported'; o.paid_reported_at = new Date().toISOString(); }
        return reply(route, 204);
      }
      if (fn === 'cancel_my_order') {
        const o = orders.find((x) => x.id === args.p_order_id && x.user_id === user.id);
        if (!o) return dbError(route, 400, 'Order not found');
        if (o.status !== 'pending' || o.payment_status !== 'awaiting') return dbError(route, 400, 'This order can no longer be cancelled here. Please contact us.');
        o.status = 'cancelled'; restock(o);
        return reply(route, 204);
      }
      if (fn === 'claim_receipt_send') return reply(route, 200, true);
      return dbError(route, 404, `fake backend: rpc ${fn} is not implemented`, 'PGRST202');
    }

    // ---- Tables
    if (path === 'products') {
      if (method === 'GET') return respondRows(route, products.filter((p) => matches(p, url)), url);
      if (!isAdmin) return dbError(route, 403, 'new row violates row-level security policy for table "products"', '42501');
      return reply(route, 204);
    }

    if (path === 'orders') {
      if (!user) return respondRows(route, [], url);
      if (method === 'GET') return respondRows(route, orders.filter((o) => (isAdmin || o.user_id === user.id) && matches(o, url)), url);
      if (method === 'PATCH') {
        if (!isAdmin) return reply(route, 204); // row level security: customers update nothing
        const patch = body(route);
        for (const o of orders.filter((x) => matches(x, url))) {
          const wasCancelled = o.status === 'cancelled';
          Object.assign(o, patch);
          if (patch.payment_status === 'confirmed' && !o.payment_confirmed_at) o.payment_confirmed_at = new Date().toISOString();
          if (patch.status === 'cancelled' && !wasCancelled) restock(o);
        }
        return reply(route, 204);
      }
    }

    if (path === 'store_settings') {
      if (!user) return dbError(route, 401, 'permission denied for table store_settings', '42501');
      const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
      return respondRows(route, rows.filter((r) => matches(r, url)), url);
    }

    // Accounting tables: admin only (everyone else sees nothing, as with real row level security)
    if (path === 'expenses') {
      if (!isAdmin) return method === 'GET' ? respondRows(route, [], url) : dbError(route, 403, 'new row violates row-level security policy for table "expenses"', '42501');
      if (method === 'GET') return respondRows(route, expenses.filter((e) => matches(e, url)), url);
      if (method === 'POST') {
        const b = body(route);
        expenses.unshift({ id: uuid(), created_at: new Date().toISOString(), vendor: null, ...b });
        return reply(route, 201);
      }
      if (method === 'DELETE') {
        for (const e of expenses.filter((x) => matches(x, url))) expenses.splice(expenses.indexOf(e), 1);
        return reply(route, 204);
      }
    }
    if (path === 'product_costs') {
      if (!isAdmin) return respondRows(route, [], url);
      if (method === 'GET') return respondRows(route, Object.entries(productCosts).map(([product_id, cost_price]) => ({ product_id, cost_price })), url);
      if (method === 'POST') { const b = body(route); productCosts[b.product_id as string] = Number(b.cost_price); return reply(route, 201); }
    }
    if (path === 'order_item_costs') {
      if (!isAdmin) return respondRows(route, [], url);
      // The cost at the time of sale: here, today's cost price for each sold item.
      const rows = orders.flatMap((o) => o.order_items.filter((i) => productCosts[i.product_id]).map((i) => ({ order_item_id: i.id, unit_cost: productCosts[i.product_id] })));
      return respondRows(route, rows, url);
    }
    if (path === 'profiles' || path === 'audit_log') return respondRows(route, [], url);

    return dbError(route, 404, `fake backend: ${method} ${path} is not implemented`, 'PGRST205');
  });

  // ---------------------------------------------------- receipt email API
  await page.route('**/api/send-receipt', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fulfill({ status: 204, headers: cors });
    const b = (req.postDataJSON() ?? {}) as { orderId?: string };
    receiptRequests.push({ orderId: b.orderId ?? '', hasToken: /^Bearer\s+tok_/.test(req.headers()['authorization'] ?? '') });
    if (options.emailFails) return route.fulfill({ status: 502, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Mailgun rejected the request', status: 403 }) });
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ sent: true }) });
  });

  // Anything else leaving the browser (fonts, analytics) is not needed and could make tests slow or flaky offline.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());

  return backend;
}
