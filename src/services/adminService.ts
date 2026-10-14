import { supabase } from '../lib/supabase';
import { adminListProductCosts } from './accountingService';
import type { Category, OrderStatus, PaymentStatus, Product, ProductStatus } from '../types';

/** Admin-only data access. Every call is also enforced by Row Level Security in the database. */

export const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
export const PRODUCT_STATUSES: ProductStatus[] = ['active', 'draft', 'archived'];
export const CATEGORY_NAMES: Category[] = ['Monitoring', 'Diagnostic', 'Mobility', 'Respiratory', 'Wound Care', 'Medical Consumables', 'General'];

const VISUAL_BY_CATEGORY: Record<Category, string> = {
  Monitoring: 'bp',
  Diagnostic: 'stethoscope',
  Mobility: 'walker',
  Respiratory: 'nebulizer',
  'Wound Care': 'plaster',
  'Medical Consumables': 'disposable',
  General: 'bp',
};

const db = () => {
  if (!supabase) throw new Error('The database is not configured.');
  return supabase;
};

export async function checkIsAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

// ------------------------------------------------------------------ products
/** costPrice is what the item costs to buy. It lives in an admin-only table (migration 008), never on the public product. */
export type AdminProduct = Product & { status: ProductStatus; costPrice?: number };

type ProductRow = {
  id: string; name: string; category: Category; description: string; short_description: string | null;
  price: number | string; stock_quantity: number; brand: string; model: string; warranty: string;
  visual: string; image_url: string | null; status: ProductStatus; created_at: string;
};

const toProduct = (r: ProductRow): AdminProduct => ({
  id: r.id, name: r.name, category: r.category, description: r.description,
  shortDescription: r.short_description ?? undefined, price: Number(r.price), stockQuantity: r.stock_quantity,
  brand: r.brand, model: r.model, warranty: r.warranty, visual: r.visual, imageUrl: r.image_url,
  status: r.status, createdAt: r.created_at,
});

export async function adminListProducts(): Promise<AdminProduct[]> {
  const { data, error } = await db().from('products').select('*').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  // Cost prices are optional: if migration 008 has not been run yet, the products still load.
  const costs = await adminListProductCosts().catch(() => ({} as Record<string, number>));
  return (data as ProductRow[]).map((r) => ({ ...toProduct(r), costPrice: costs[r.id] }));
}

/** Next free product id such as vm-015. */
export function nextProductId(existing: { id: string }[]): string {
  const max = existing.reduce((m, p) => {
    const n = /^vm-(\d+)$/.exec(p.id);
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `vm-${String(max + 1).padStart(3, '0')}`;
}

export async function adminSaveProduct(p: AdminProduct): Promise<void> {
  const row = {
    id: p.id,
    name: p.name.trim(),
    category: p.category,
    description: p.description.trim(),
    short_description: p.shortDescription?.trim() || null,
    price: p.price,
    stock_quantity: p.stockQuantity,
    brand: p.brand.trim() || 'Vi-Medics',
    model: p.model.trim() || p.id.toUpperCase(),
    warranty: p.warranty.trim() || 'None',
    visual: p.visual || VISUAL_BY_CATEGORY[p.category],
    image_url: p.imageUrl || null,
    status: p.status,
  };
  const { error } = await db().from('products').upsert(row);
  if (error) throw new Error(error.message);
}

export const blankProduct = (id: string): AdminProduct => ({
  id, name: '', category: 'Monitoring', description: '', shortDescription: '', price: 0, stockQuantity: 0,
  brand: 'Vi-Medics', model: '', warranty: '12 months', visual: '', imageUrl: null, status: 'active',
});

/** Uploads a photo to the public product-images bucket and returns its public URL. */
export async function uploadProductImage(file: File, productId: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${productId}-${Date.now()}.${ext}`;
  const { error } = await db().storage.from('product-images').upload(path, file, { contentType: file.type || undefined, upsert: true });
  if (error) throw new Error(error.message);
  return db().storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

// -------------------------------------------------------------------- orders
export type AdminOrder = {
  id: string; orderNumber: string; status: OrderStatus; paymentStatus: PaymentStatus; total: number; createdAt: string;
  paidReportedAt: string | null; paymentConfirmedAt: string | null; deliveredAt: string | null;
  customerName: string; customerEmail: string; customerPhone: string; address: string; city: string; state: string;
  items: { id: string; productName: string; unitPrice: number; quantity: number }[];
};

type OrderRow = {
  id: string; order_number: number; status: OrderStatus; payment_status: PaymentStatus; total: number | string; created_at: string;
  paid_reported_at: string | null; payment_confirmed_at: string | null; delivered_at: string | null;
  customer_name: string; customer_email: string; customer_phone: string; address: string; city: string; state: string;
  order_items: { id: string; product_name: string; unit_price: number | string; quantity: number }[];
};

export async function adminListOrders(): Promise<AdminOrder[]> {
  const { data, error } = await db()
    .from('orders')
    .select('id, order_number, status, payment_status, total, created_at, paid_reported_at, payment_confirmed_at, delivered_at, customer_name, customer_email, customer_phone, address, city, state, order_items(id, product_name, unit_price, quantity)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data as unknown as OrderRow[]).map((r) => ({
    id: r.id, orderNumber: `VM-${r.order_number}`, status: r.status, paymentStatus: r.payment_status, total: Number(r.total), createdAt: r.created_at,
    paidReportedAt: r.paid_reported_at, paymentConfirmedAt: r.payment_confirmed_at, deliveredAt: r.delivered_at,
    customerName: r.customer_name, customerEmail: r.customer_email, customerPhone: r.customer_phone,
    address: r.address, city: r.city, state: r.state,
    items: r.order_items.map((i) => ({ id: i.id, productName: i.product_name, unitPrice: Number(i.unit_price), quantity: i.quantity })),
  }));
}

export async function adminUpdateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await db().from('orders').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Marks the payment as received in the bank account. A pending order becomes confirmed at the same time. */
export async function adminConfirmPayment(id: string, currentStatus: OrderStatus): Promise<void> {
  const patch: { payment_status: PaymentStatus; status?: OrderStatus } = { payment_status: 'confirmed' };
  if (currentStatus === 'pending') patch.status = 'confirmed';
  const { error } = await db().from('orders').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------ payment settings
export type PaymentSettings = { bankName: string; accountName: string; accountNumber: string };

export async function adminSavePaymentSettings(s: PaymentSettings): Promise<void> {
  const rows = [
    { key: 'bank_name', value: s.bankName.trim() },
    { key: 'account_name', value: s.accountName.trim() },
    { key: 'account_number', value: s.accountNumber.trim() },
  ].map((r) => ({ ...r, updated_at: new Date().toISOString() }));
  const { error } = await db().from('store_settings').upsert(rows);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------------ audit trail
export type AuditEntry = {
  id: number; createdAt: string; actorEmail: string; actorName: string; actorRole: string;
  action: string; entity: string; entityId: string; summary: string; details: Record<string, unknown>;
};

type AuditRow = {
  id: number; created_at: string; actor_email: string | null; actor_name: string | null; actor_role: string;
  action: string; entity: string | null; entity_id: string | null; summary: string; details: Record<string, unknown> | null;
};

export async function adminListAudit(limit: number): Promise<AuditEntry[]> {
  const { data, error } = await db().from('audit_log').select('*').order('id', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data as AuditRow[]).map((r) => ({
    id: r.id, createdAt: r.created_at, actorEmail: r.actor_email ?? '', actorName: r.actor_name ?? '', actorRole: r.actor_role,
    action: r.action, entity: r.entity ?? '', entityId: r.entity_id ?? '', summary: r.summary, details: r.details ?? {},
  }));
}

// ----------------------------------------------------------------- customers
export type AdminCustomer = {
  id: string; name: string; email: string; phone: string; joined: string;
  orderCount: number; totalSpent: number; lastOrder: string | null; address: string;
};

export async function adminListCustomers(): Promise<AdminCustomer[]> {
  const client = db();
  const [profiles, orders] = await Promise.all([
    client.from('profiles').select('id, full_name, email, phone, created_at').order('created_at', { ascending: false }).limit(1000),
    client.from('orders').select('user_id, total, status, created_at, customer_phone, address, city, state').order('created_at', { ascending: false }).limit(1000),
  ]);
  if (profiles.error) throw new Error(profiles.error.message);
  if (orders.error) throw new Error(orders.error.message);

  type O = { user_id: string; total: number | string; status: OrderStatus; created_at: string; customer_phone: string; address: string; city: string; state: string };
  const byUser = new Map<string, O[]>();
  for (const o of orders.data as O[]) byUser.set(o.user_id, [...(byUser.get(o.user_id) ?? []), o]);

  return (profiles.data as { id: string; full_name: string | null; email: string | null; phone: string | null; created_at: string }[]).map((p) => {
    const mine = byUser.get(p.id) ?? []; // newest first
    const latest = mine[0];
    return {
      id: p.id,
      name: p.full_name || '(no name)',
      email: p.email || '',
      phone: p.phone || latest?.customer_phone || '',
      joined: p.created_at,
      orderCount: mine.length,
      totalSpent: mine.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0),
      lastOrder: latest?.created_at ?? null,
      address: latest ? `${latest.address}, ${latest.city}, ${latest.state}` : '',
    };
  });
}
