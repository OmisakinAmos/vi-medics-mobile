import { supabase } from '../lib/supabase';
import type { Expense, ExpenseCategory, SaleLine } from '../lib/accounting';

/** Admin-only accounting data. Every call is also enforced by Row Level Security (see migration 008). */

const db = () => {
  if (!supabase) throw new Error('The database is not configured.');
  return supabase;
};

const PAGE = 1000; // the database returns at most 1000 rows per request

async function pageAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 100000; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// ------------------------------------------------------------- product costs
export async function adminListProductCosts(): Promise<Record<string, number>> {
  const rows = await pageAll<{ product_id: string; cost_price: number | string }>((a, b) =>
    db().from('product_costs').select('product_id, cost_price').order('product_id').range(a, b));
  return Object.fromEntries(rows.map((r) => [r.product_id, Number(r.cost_price)]));
}

export async function adminSaveProductCost(productId: string, costPrice: number): Promise<void> {
  const { error } = await db().from('product_costs').upsert({ product_id: productId, cost_price: costPrice, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// --------------------------------------------------------------------- sales
type SaleOrderRow = {
  id: string; order_number: number; payment_confirmed_at: string | null; created_at: string; city: string; state: string;
  order_items: { id: string; product_id: string; product_name: string; unit_price: number | string; quantity: number }[];
};

/** Every product line of every counted sale: payment confirmed and not cancelled. */
export async function adminListSalesLines(): Promise<SaleLine[]> {
  const [orders, snapshots, current] = await Promise.all([
    pageAll<SaleOrderRow>((a, b) =>
      db().from('orders')
        .select('id, order_number, payment_confirmed_at, created_at, city, state, order_items(id, product_id, product_name, unit_price, quantity)')
        .eq('payment_status', 'confirmed').neq('status', 'cancelled')
        .order('created_at', { ascending: true }).order('id', { ascending: true }).range(a, b)),
    pageAll<{ order_item_id: string; unit_cost: number | string }>((a, b) =>
      db().from('order_item_costs').select('order_item_id, unit_cost').order('order_item_id').range(a, b)),
    adminListProductCosts(),
  ]);
  const snap = new Map(snapshots.map((s) => [s.order_item_id, Number(s.unit_cost)]));
  const lines: SaleLine[] = [];
  for (const o of orders) {
    for (const i of o.order_items) {
      const sold = snap.get(i.id);
      const now = current[i.product_id] ?? 0;
      const unitCost = sold ?? now; // the cost at the time of sale wins; otherwise today's cost price
      lines.push({
        orderId: o.id, orderNumber: `VM-${o.order_number}`, soldAt: o.payment_confirmed_at ?? o.created_at,
        state: o.state, city: o.city, productId: i.product_id, productName: i.product_name,
        quantity: i.quantity, unitPrice: Number(i.unit_price), unitCost, costKnown: sold !== undefined || now > 0,
      });
    }
  }
  return lines;
}

// ------------------------------------------------------------------ expenses
type ExpenseRow = { id: string; spent_on: string; category: ExpenseCategory; description: string; vendor: string | null; amount: number | string };

export async function adminListExpenses(): Promise<Expense[]> {
  const rows = await pageAll<ExpenseRow>((a, b) =>
    db().from('expenses').select('id, spent_on, category, description, vendor, amount')
      .order('spent_on', { ascending: false }).order('created_at', { ascending: false }).range(a, b));
  return rows.map((r) => ({ id: r.id, spentOn: r.spent_on, category: r.category, description: r.description, vendor: r.vendor ?? '', amount: Number(r.amount) }));
}

export async function adminAddExpense(e: Omit<Expense, 'id'>): Promise<void> {
  const { error } = await db().from('expenses').insert({
    spent_on: e.spentOn, category: e.category, description: e.description.trim(), vendor: e.vendor.trim() || null, amount: e.amount,
  });
  if (error) throw new Error(error.message);
}

export async function adminDeleteExpense(id: string): Promise<void> {
  const { error } = await db().from('expenses').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
