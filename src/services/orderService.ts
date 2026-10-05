import { supabase } from '../lib/supabase';
import type { CartItem, Order, OrderStatus } from '../types';

export type CustomerDetails = { name: string; email: string; phone: string; address: string; city: string; state: string; country: string };

export type PlacedOrder = { id: string; orderNumber: string; total: number };

type OrderRow = {
  id: string;
  order_number: number;
  status: OrderStatus;
  subtotal: number | string;
  delivery_fee: number | string;
  total: number | string;
  created_at: string;
  order_items: { id: string; product_id: string; product_name: string; unit_price: number | string; quantity: number }[];
};

// In the web build the API is same-origin; in the Android app it must point at the deployed site.
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

const formatOrderNumber = (n: number) => `VM-${n}`;

const toOrder = (row: OrderRow): Order => ({
  id: row.id,
  orderNumber: formatOrderNumber(row.order_number),
  status: row.status,
  subtotal: Number(row.subtotal),
  deliveryFee: Number(row.delivery_fee),
  total: Number(row.total),
  createdAt: row.created_at,
  items: row.order_items.map((i) => ({ id: i.id, productId: i.product_id, productName: i.product_name, unitPrice: Number(i.unit_price), quantity: i.quantity })),
});

/** Creates an order via the place_order() database function (validates stock, prices come from the DB). */
export async function placeOrder(cart: CartItem[], customer: CustomerDetails): Promise<PlacedOrder> {
  if (!supabase) throw new Error('Orders are not available because the database is not configured.');
  const items = cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity }));
  const { data: orderId, error } = await supabase.rpc('place_order', { p_items: items, p_customer: customer });
  if (error) throw new Error(error.message);
  const { data, error: readError } = await supabase.from('orders').select('id, order_number, total').eq('id', orderId as string).single();
  if (readError) throw new Error(readError.message);
  return { id: data.id as string, orderNumber: formatOrderNumber(data.order_number as number), total: Number(data.total) };
}

/** Lists the signed-in customer's orders (row level security restricts this to their own). */
export async function listMyOrders(): Promise<Order[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, status, subtotal, delivery_fee, total, created_at, order_items(id, product_id, product_name, unit_price, quantity)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as OrderRow[]).map(toOrder);
}

/** Asks the server to email an order confirmation. Best effort: never blocks or fails the order. */
export async function requestConfirmationEmail(orderId: string, accessToken: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/send-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ orderId }),
    });
  } catch {
    /* ignore */
  }
}
